const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');

// Configure Supabase client
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Configure multer for memory storage (no disk writes)
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: function (req, file, cb) {
        // Accept only image files
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'), false);
        }
    }
});
const fs = require('fs');
require('dotenv').config();

// Import our modules
const { initDatabase, query, run } = require('./database/schema');
const { generatePDF } = require('./services/pdfGenerator');
const pdfGenerator = require('./services/pdfGenerator');

const app = express();
const port = process.env.PORT || 3000;

// Security middleware - Remove all CSP headers to allow Supabase images
app.use((req, res, next) => {
    // Remove any existing CSP headers
    res.removeHeader('Content-Security-Policy');
    res.removeHeader('Content-Security-Policy-Report-Only');
    
    // Set permissive CSP that allows everything
    res.setHeader('Content-Security-Policy', "img-src *; default-src *; style-src * 'unsafe-inline'; script-src * 'unsafe-inline';");
    
    console.log('CSP Headers set:', res.getHeaders()['content-security-policy']);
    next();
});

// Keep helmet disabled for now
// app.use(helmet({
//     contentSecurityPolicy: false,
// }));
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Serve static files
app.use(express.static('public'));
app.use('/badges', express.static(path.join(__dirname, 'public/badges')));

// Explicit routes for test pages
app.get('/test.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/test.html'));
});

app.get('/debug.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/debug.html'));
});

// Debug route to test static file serving
app.get('/test-static', (req, res) => {
    res.json({
        message: 'Static file serving test',
        publicPath: path.join(__dirname, 'public'),
        assetsPath: path.join(__dirname, 'public/assets'),
        files: require('fs').readdirSync(path.join(__dirname, 'public/assets/images'))
    });
});

// Test endpoint to check demo users
app.get('/test-users', async (req, res) => {
    try {
        console.log('Testing database connection...');
        console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);
        console.log('NODE_ENV:', process.env.NODE_ENV);
        
        const users = await query('SELECT id, email, first_name, last_name, role, is_super_admin FROM users');
        res.json({
            message: 'Demo users check',
            totalUsers: users.length,
            users: users
        });
    } catch (error) {
        console.error('Error checking users:', error);
        res.status(500).json({ 
            error: 'Database error', 
            details: error.message,
            code: error.code,
            hint: error.hint
        });
    }
});

// Simple database connection test
app.get('/test-db', async (req, res) => {
    try {
        console.log('Testing basic database connection...');
        console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);
        console.log('NODE_ENV:', process.env.NODE_ENV);
        
        // Test basic connection
        const result = await query('SELECT NOW() as current_time, version() as db_version');
        
        res.json({
            message: 'Database connection successful',
            currentTime: result[0].current_time,
            dbVersion: result[0].db_version,
            env: {
                nodeEnv: process.env.NODE_ENV,
                hasDatabaseUrl: !!process.env.DATABASE_URL
            }
        });
    } catch (error) {
        console.error('Database connection test failed:', error);
        res.status(500).json({ 
            error: 'Database connection failed', 
            details: error.message,
            code: error.code,
            hint: error.hint,
            env: {
                nodeEnv: process.env.NODE_ENV,
                hasDatabaseUrl: !!process.env.DATABASE_URL
            }
        });
    }
});

// Initialize database endpoint (for testing)
app.post('/init-db', async (req, res) => {
    try {
        console.log('Manual database initialization requested');
        console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);
        console.log('NODE_ENV:', process.env.NODE_ENV);
        
        await initDatabase();
        console.log('Database initialization completed');
        
        // Also create the missing company_roles table
        try {
            await query(`
                CREATE TABLE IF NOT EXISTS company_roles (
                    id SERIAL PRIMARY KEY,
                    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
                    role_name TEXT NOT NULL,
                    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(company_id, role_name)
                )
            `);
            console.log('company_roles table created successfully');
        } catch (tableError) {
            console.log('company_roles table already exists or error:', tableError.message);
        }
        
        // Check if users were created
        const users = await query('SELECT id, email, first_name, last_name, role, is_super_admin FROM users');
        
        res.json({
            message: 'Database initialized successfully',
            totalUsers: users.length,
            users: users
        });
    } catch (error) {
        console.error('Database initialization error:', error);
        res.status(500).json({ 
            error: 'Database initialization failed', 
            details: error.message,
            code: error.code,
            hint: error.hint
        });
    }
});

// Simple endpoint to create missing tables (GET method)
app.get('/fix-tables', async (req, res) => {
    try {
        console.log('Creating missing tables via GET endpoint...');
        
        // Create company_roles table if it doesn't exist
        await query(`
            CREATE TABLE IF NOT EXISTS company_roles (
                id SERIAL PRIMARY KEY,
                company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
                role_name TEXT NOT NULL,
                assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(company_id, role_name)
            )
        `);
        
        console.log('company_roles table created successfully');
        
        res.json({
            message: 'Missing tables created successfully',
            createdTables: ['company_roles'],
            status: 'success'
        });
    } catch (error) {
        console.error('Create missing tables error:', error);
        res.status(500).json({ 
            error: 'Failed to create missing tables', 
            details: error.message
        });
    }
});

// Check database tables endpoint
app.get('/check-db-tables', async (req, res) => {
    try {
        console.log('Checking database tables...');
        
        const tables = await query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name
        `);
        
        const tableNames = tables.map(t => t.table_name);
        console.log('Found tables:', tableNames);
        
        // Check if companies table exists and has data
        let companiesCount = 0;
        if (tableNames.includes('companies')) {
            const countResult = await query('SELECT COUNT(*) as count FROM companies');
            companiesCount = countResult[0].count;
        }
        
        res.json({
            message: 'Database tables check completed',
            tables: tableNames,
            companiesCount: companiesCount,
            hasCompaniesTable: tableNames.includes('companies'),
            hasCompanyRolesTable: tableNames.includes('company_roles')
        });
    } catch (error) {
        console.error('Database tables check error:', error);
        res.status(500).json({ 
            error: 'Database tables check failed', 
            details: error.message
        });
    }
});

// Create missing tables endpoint
app.post('/create-missing-tables', async (req, res) => {
    try {
        console.log('Creating missing tables...');
        
        // Create company_roles table if it doesn't exist
        await query(`
            CREATE TABLE IF NOT EXISTS company_roles (
                id SERIAL PRIMARY KEY,
                company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
                role_name TEXT NOT NULL,
                assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(company_id, role_name)
            )
        `);
        
        console.log('company_roles table created successfully');
        
        res.json({
            message: 'Missing tables created successfully',
            createdTables: ['company_roles']
        });
    } catch (error) {
        console.error('Create missing tables error:', error);
        res.status(500).json({ 
            error: 'Failed to create missing tables', 
            details: error.message
        });
    }
});

// JWT Secret (in production, use environment variable)
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Authentication middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid token' });
        }
        req.user = user;
        next();
    });
};

// Super Admin Middleware
const requireSuperAdmin = (req, res, next) => {
    if (!req.user.is_super_admin) {
        return res.status(403).json({ error: 'Super admin access required' });
    }
    next();
};

// Generate unique badge number
const generateBadgeNumber = () => {
    return 'YP' + Date.now().toString().slice(-6) + Math.random().toString(36).substr(2, 3).toUpperCase();
};

// API Routes

// Authentication
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        console.log('Login attempt for email:', email);
        
        // Test database connection first
        try {
            await query('SELECT 1 as test');
            console.log('Database connection successful');
        } catch (dbError) {
            console.error('Database connection failed:', dbError);
            return res.status(500).json({ error: 'Database connection failed' });
        }
        
        const users = await query('SELECT * FROM users WHERE email = $1', [email]);
        console.log('Users found:', users.length);
        
        if (users.length === 0) {
            console.log('No user found with email:', email);
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = users[0];
        console.log('User found:', { id: user.id, email: user.email, role: user.role, is_super_admin: user.is_super_admin });
        
        const validPassword = await bcrypt.compare(password, user.password_hash);
        console.log('Password valid:', validPassword);
        
        if (!validPassword) {
            console.log('Invalid password for user:', email);
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role, is_super_admin: user.is_super_admin, company_id: user.company_id },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        console.log('Login successful for user:', email);

        res.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                role: user.role,
                is_super_admin: user.is_super_admin,
                company_id: user.company_id
            }
        });
    } catch (error) {
        console.error('Login error details:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({ error: 'Internal server error: ' + error.message });
    }
});

// Get events
app.get('/api/events', async (req, res) => {
    try {
        const events = await query('SELECT * FROM events ORDER BY start_date ASC');
        res.json(events);
    } catch (error) {
        console.error('Get events error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get crew members for an event
app.get('/api/events/:eventId/crew', authenticateToken, async (req, res) => {
    try {
        const { eventId } = req.params;
        const companyId = req.user.company_id;
        const isSuperAdmin = req.user.is_super_admin;

        let crew;
        // Check if company_id column exists in crew_members table
        const columnExists = await query(`
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'crew_members' AND column_name = 'company_id'
        `);

        if (columnExists.length > 0) {
            if (isSuperAdmin) {
                // Super admin sees all crew members with company info
                crew = await query(`
                    SELECT cm.id, cm.first_name, cm.last_name, cm.email, cm.role, cm.access_level, 
                           cm.badge_number, cm.status, cm.created_at, cm.company_id,
                           c.name as company_name
                    FROM crew_members cm
                    LEFT JOIN companies c ON cm.company_id = c.id
                    WHERE cm.event_id = $1 
                    ORDER BY cm.created_at DESC
                `, [eventId]);
            } else {
                // Company users only see their own crew members
                crew = await query(`
                    SELECT id, first_name, last_name, email, role, access_level, badge_number, status, created_at
                    FROM crew_members 
                    WHERE event_id = $1 AND company_id = $2
                    ORDER BY created_at DESC
                `, [eventId, companyId]);
            }
        } else {
            // Fallback: old behavior without company filtering (until migration is run)
            crew = await query(`
                SELECT id, first_name, last_name, email, role, access_level, badge_number, status, created_at
                FROM crew_members 
                WHERE event_id = $1 
                ORDER BY created_at DESC
            `, [eventId]);
        }

        res.json(crew);
    } catch (error) {
        console.error('Get crew error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Debug headers endpoint
app.get('/api/debug-headers', (req, res) => {
    res.json({
        message: 'Headers debug',
        allHeaders: res.getHeaders(),
        cspHeader: res.getHeader('Content-Security-Policy'),
        timestamp: new Date().toISOString()
    });
});

// Test Supabase configuration endpoint
app.get('/api/test-supabase-config', authenticateToken, (req, res) => {
    try {
        res.json({
            supabaseUrl: process.env.SUPABASE_URL ? 'SET' : 'NOT SET',
            supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'NOT SET',
            photoBucket: process.env.SUPABASE_PHOTOS_BUCKET || 'crew-photos (default)',
            crewlistBucket: process.env.SUPABASE_CREWLIST_BUCKET ? 'SET' : 'NOT SET',
            supabaseClient: supabase ? 'INITIALIZED' : 'NOT INITIALIZED'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Test Supabase storage endpoint
app.get('/api/test-storage', authenticateToken, async (req, res) => {
    try {
        const bucketName = process.env.SUPABASE_PHOTOS_BUCKET || 'crew-photos';
        
        // List files in the bucket
        const { data, error } = await supabase.storage
            .from(bucketName)
            .list('', {
                limit: 10,
                offset: 0
            });
        
        if (error) {
            return res.status(500).json({ error: 'Storage test failed: ' + error.message });
        }
        
        res.json({
            message: 'Supabase storage test successful',
            bucket: bucketName,
            files: data,
            supabaseUrl: process.env.SUPABASE_URL ? 'SET' : 'NOT SET',
            serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'NOT SET'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Setup storage policies endpoint
app.post('/api/setup-storage-policies', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        const bucketName = process.env.SUPABASE_PHOTOS_BUCKET || 'crew-photos';
        
        // Create storage policies using SQL
        const policies = [
            {
                name: 'Allow authenticated uploads',
                sql: `
                    CREATE POLICY "Allow authenticated uploads" ON storage.objects
                    FOR INSERT WITH CHECK (
                        bucket_id = '${bucketName}' AND 
                        auth.role() = 'authenticated'
                    );
                `
            },
            {
                name: 'Allow public downloads',
                sql: `
                    CREATE POLICY "Allow public downloads" ON storage.objects
                    FOR SELECT USING (bucket_id = '${bucketName}');
                `
            }
        ];
        
        const results = [];
        
        for (const policy of policies) {
            try {
                await query(policy.sql);
                results.push({ policy: policy.name, status: 'created' });
            } catch (error) {
                if (error.message.includes('already exists')) {
                    results.push({ policy: policy.name, status: 'already exists' });
                } else {
                    results.push({ policy: policy.name, status: 'failed', error: error.message });
                }
            }
        }
        
        res.json({
            message: 'Storage policies setup completed',
            bucket: bucketName,
            results
        });
        
    } catch (error) {
        console.error('Setup storage policies error:', error);
        res.status(500).json({ error: error.message });
    }
});

// File upload endpoint using Supabase Storage
app.post('/api/upload', authenticateToken, (req, res) => {
    // Use multer middleware with error handling
    upload.single('photo')(req, res, async (err) => {
        if (err) {
            console.error('Multer error:', err);
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ error: 'File too large. Maximum size is 5MB.' });
            }
            if (err.message === 'Only image files are allowed!') {
                return res.status(400).json({ error: 'Only image files are allowed.' });
            }
            return res.status(500).json({ error: 'File upload failed: ' + err.message });
        }
        
        try {
            if (!req.file) {
                return res.status(400).json({ error: 'No file uploaded' });
            }
            
            console.log('File received for upload:', {
                originalname: req.file.originalname,
                mimetype: req.file.mimetype,
                size: req.file.size
            });
            
            // Generate unique filename
            const fileExtension = path.extname(req.file.originalname);
            const uniqueFilename = `crew-photo-${Date.now()}-${Math.round(Math.random() * 1E9)}${fileExtension}`;
            
            // Check Supabase configuration
            if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
                console.error('Supabase configuration missing');
                return res.status(500).json({ 
                    error: 'Storage service not configured. Please contact administrator.',
                    debug: {
                        supabaseUrl: process.env.SUPABASE_URL ? 'SET' : 'MISSING',
                        serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'MISSING'
                    }
                });
            }
            
            // Upload to Supabase Storage
            const bucketName = process.env.SUPABASE_PHOTOS_BUCKET || 'crew-photos';
            console.log(`Attempting upload to bucket: ${bucketName}`);
            
            const { data, error } = await supabase.storage
                .from(bucketName)
                .upload(uniqueFilename, req.file.buffer, {
                    contentType: req.file.mimetype,
                    upsert: false
                });
            
            if (error) {
                console.error('Supabase storage error:', error);
                return res.status(500).json({ 
                    error: 'Failed to upload to storage: ' + error.message,
                    debug: {
                        bucket: bucketName,
                        filename: uniqueFilename,
                        errorCode: error.statusCode,
                        errorMessage: error.message
                    }
                });
            }
            
            console.log('File uploaded to Supabase successfully:', data);
            
            // Get public URL for the uploaded file
            const { data: urlData } = supabase.storage
                .from(bucketName)
                .getPublicUrl(uniqueFilename);
            
            res.json({
                message: 'File uploaded successfully',
                path: urlData.publicUrl,
                filename: uniqueFilename,
                originalName: req.file.originalname,
                size: req.file.size,
                bucket: bucketName
            });
            
        } catch (error) {
            console.error('File upload processing error:', error);
            res.status(500).json({ error: 'File upload processing failed: ' + error.message });
        }
    });
});

// Add crew member
app.post('/api/events/:eventId/crew', authenticateToken, async (req, res) => {
    try {
        const { eventId } = req.params;
        const { firstName, lastName, email, role, photoPath } = req.body;
        const companyId = req.user.company_id;

        // Log incoming data for debugging
        console.log('Add crew member request:', { eventId, firstName, lastName, email, role, photoPath, companyId });

        // Validate required fields
        if (!firstName || !lastName || !email || !role) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // For company admins, verify they have access to this event
        if (!req.user.is_super_admin && companyId) {
            try {
                // Check if this event is assigned to the user's company
                const eventAccess = await query(`
                    SELECT 1 as access FROM event_companies ec
                    WHERE ec.event_id = $1 AND ec.company_id = $2
                    UNION ALL
                    SELECT 1 as access FROM events e
                    WHERE e.id = $1 AND e.company_id = $2
                    LIMIT 1
                `, [eventId, companyId]);
                
                if (eventAccess.length === 0) {
                    console.log(`Access denied: Cannot add crew to event ${eventId} - not assigned to company ${companyId}`);
                    return res.status(403).json({ error: 'Access denied: Cannot add crew to this event' });
                }
            } catch (authError) {
                console.error('Add crew authorization check error:', authError);
                return res.status(500).json({ error: 'Authorization check failed' });
            }
        }

        // Validate event exists first
        const events = await query('SELECT * FROM events WHERE id = $1', [eventId]);
        if (events.length === 0) {
            return res.status(404).json({ error: 'Event not found' });
        }
        const event = events[0];

        // Generate unique badge number
        const badgeNumber = generateBadgeNumber();

        console.log('Inserting crew member into DB...');
        
        // Check if company_id column exists first
        const columnExists = await query(`
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'crew_members' AND column_name = 'company_id'
        `);
        
        let result;
        if (columnExists.length > 0) {
            // New behavior: include company_id and photo_path
            result = await run(`
                INSERT INTO crew_members (event_id, first_name, last_name, email, role, access_level, badge_number, photo_path, company_id)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING id
            `, [eventId, firstName, lastName, email, role, 'RESTRICTED', badgeNumber, photoPath, companyId]);
            console.log(`Crew member inserted with company_id ${companyId} and photo_path ${photoPath}, result:`, result);
        } else {
            // Fallback: legacy behavior without company_id but with photo_path
            result = await run(`
                INSERT INTO crew_members (event_id, first_name, last_name, email, role, access_level, badge_number, photo_path)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING id
            `, [eventId, firstName, lastName, email, role, 'RESTRICTED', badgeNumber, photoPath]);
            console.log('Crew member inserted (legacy mode) with photo_path, result:', result);
        }

        // Get the created crew member
        const crewMembers = await query('SELECT * FROM crew_members WHERE id = $1', [result.id]);
        const crewMember = crewMembers[0];

        // Generate PDF badge (SKIPPED until approval)
        // const badgeResult = await pdfGenerator.generateBadge(crewMember, event);

        res.json({
            ...crewMember,
            // badgeUrl: badgeResult.url, // Not generated yet
            message: 'Employee added successfully. Accreditation is pending approval.'
        });
    } catch (error) {
        console.error('Add crew error:', error.stack || error);
        // TEMP: Return full error message and stack in all environments for debugging
        return res.status(500).json({ error: error.message || 'Internal server error', stack: error.stack });
    }
});

// Generate crew list PDF
app.get('/api/events/:eventId/crew/pdf', authenticateToken, async (req, res) => {
    try {
        const { eventId } = req.params;
        const companyId = req.user.company_id;

        // For company admins, verify they have access to this event
        if (!req.user.is_super_admin && companyId) {
            try {
                // Check if this event is assigned to the user's company
                const eventAccess = await query(`
                    SELECT 1 as access FROM event_companies ec
                    WHERE ec.event_id = $1 AND ec.company_id = $2
                    UNION ALL
                    SELECT 1 as access FROM events e
                    WHERE e.id = $1 AND e.company_id = $2
                    LIMIT 1
                `, [eventId, companyId]);
                
                if (eventAccess.length === 0) {
                    console.log(`Access denied: Cannot generate PDF for event ${eventId} - not assigned to company ${companyId}`);
                    return res.status(403).json({ error: 'Access denied: Cannot generate PDF for this event' });
                }
            } catch (authError) {
                console.error('PDF generation authorization check error:', authError);
                return res.status(500).json({ error: 'Authorization check failed' });
            }
        }

        // Validate event exists first
        const events = await query('SELECT * FROM events WHERE id = $1', [eventId]);
        if (events.length === 0) {
            return res.status(404).json({ error: 'Event not found' });
        }
        const event = events[0];

        // Get crew members with company information (filter by company for company admins)
        let crewQuery, crewParams;
        
        if (req.user.is_super_admin) {
            // Super admin sees all crew members for the event
            crewQuery = `
                SELECT 
                    cm.id, 
                    cm.first_name, 
                    cm.last_name, 
                    cm.role, 
                    cm.access_level, 
                    cm.badge_number, 
                    cm.status,
                    c.name as company_name
                FROM crew_members cm
                LEFT JOIN companies c ON cm.company_id = c.id
                WHERE cm.event_id = $1 
                ORDER BY cm.status DESC, cm.created_at DESC
            `;
            crewParams = [eventId];
        } else {
            // Company admin only sees their own company's crew members
            crewQuery = `
                SELECT 
                    cm.id, 
                    cm.first_name, 
                    cm.last_name, 
                    cm.role, 
                    cm.access_level, 
                    cm.badge_number, 
                    cm.status,
                    c.name as company_name
                FROM crew_members cm
                LEFT JOIN companies c ON cm.company_id = c.id
                WHERE cm.event_id = $1 AND cm.company_id = $2
                ORDER BY cm.status DESC, cm.created_at DESC
            `;
            crewParams = [eventId, companyId];
        }
        
        const crewMembers = await query(crewQuery, crewParams);

        // Generate PDF directly in memory
        console.log(`Generating crew list PDF for event ${eventId} with ${crewMembers.length} crew members (User: ${req.user.is_super_admin ? 'Super Admin' : 'Company Admin'})`);
        
        // Add company filter info for company admins
        const pdfOptions = {
            isCompanyFiltered: !req.user.is_super_admin,
            companyName: null
        };
        
        if (!req.user.is_super_admin) {
            const companyResult = await query('SELECT name FROM companies WHERE id = $1', [companyId]);
            pdfOptions.companyName = companyResult.length > 0 ? companyResult[0].name : 'Your Company';
        }
        
        const pdfBuffer = await pdfGenerator.generateCrewListDirect(crewMembers, event, pdfOptions);

        // Set headers for PDF response (include company name for company admins)
        let filename;
        if (req.user.is_super_admin) {
            filename = `crew_list_${event.name.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
        } else {
            // Get company name for filename
            const companyResult = await query('SELECT name FROM companies WHERE id = $1', [companyId]);
            const companyName = companyResult.length > 0 ? companyResult[0].name.replace(/[^a-zA-Z0-9]/g, '_') : 'Company';
            filename = `crew_list_${event.name.replace(/[^a-zA-Z0-9]/g, '_')}_${companyName}_${new Date().toISOString().split('T')[0]}.pdf`;
        }
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', pdfBuffer.length);
        
        res.send(pdfBuffer);
    } catch (error) {
        console.error('Generate crew list error:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({ 
            error: 'Internal server error', 
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Update crew member status
app.put('/api/crew/:crewId', authenticateToken, async (req, res) => {
    try {
        const { crewId } = req.params;
        const { status } = req.body;
        const companyId = req.user.company_id;

        // Get crew member details first
        const crewMembers = await query('SELECT * FROM crew_members WHERE id = $1', [crewId]);
        if (crewMembers.length === 0) {
            return res.status(404).json({ error: 'Crew member not found' });
        }
        const crewMember = crewMembers[0];
        
        // For company admins, verify they own this crew member
        if (!req.user.is_super_admin && companyId) {
            // Check if company_id column exists first
            const columnExists = await query(`
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'crew_members' AND column_name = 'company_id'
            `);
            
            if (columnExists.length > 0) {
                // New behavior: direct company ownership check
                if (crewMember.company_id !== companyId) {
                    console.log(`Access denied: Crew member ${crewId} belongs to company ${crewMember.company_id}, user is from company ${companyId}`);
                    return res.status(403).json({ error: 'Access denied: Cannot delete crew member from another company' });
                }
            } else {
                // Fallback: check event-company relationship (legacy)
                try {
                    const eventAccess = await query(`
                        SELECT 1 as access FROM event_companies ec
                        WHERE ec.event_id = $1 AND ec.company_id = $2
                        UNION ALL
                        SELECT 1 as access FROM events e
                        WHERE e.id = $1 AND e.company_id = $2
                        LIMIT 1
                    `, [crewMember.event_id, companyId]);
                    
                    if (eventAccess.length === 0) {
                        console.log(`Access denied: Crew member ${crewId} belongs to event not assigned to company ${companyId}`);
                        return res.status(403).json({ error: 'Access denied: Cannot delete crew member from this event' });
                    }
                } catch (authError) {
                    console.error('Delete authorization check error:', authError);
                    return res.status(500).json({ error: 'Authorization check failed' });
                }
            }
        }

        await run('UPDATE crew_members SET status = $1 WHERE id = $2', [status, crewId]);
        
        const updatedCrewMembers = await query('SELECT * FROM crew_members WHERE id = $1', [crewId]);
        res.json(updatedCrewMembers[0]);
    } catch (error) {
        console.error('Update crew error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete crew member
app.delete('/api/crew/:crewId', authenticateToken, async (req, res) => {
    try {
        const { crewId } = req.params;
        const companyId = req.user.company_id;
        
        console.log(`Delete crew request - Crew ID: ${crewId}, User Company: ${companyId}`);
        
        // Get crew member details first
        const crewMembers = await query('SELECT * FROM crew_members WHERE id = $1', [crewId]);
        if (crewMembers.length === 0) {
            return res.status(404).json({ error: 'Crew member not found' });
        }
        const crewMember = crewMembers[0];
        
        // For company admins, verify they have access to this crew member's event
        if (!req.user.is_super_admin && companyId) {
            try {
                // Check if the crew member's event is assigned to the user's company
                const eventAccess = await query(`
                    SELECT 1 as access FROM event_companies ec
                    WHERE ec.event_id = $1 AND ec.company_id = $2
                    UNION ALL
                    SELECT 1 as access FROM events e
                    WHERE e.id = $1 AND e.company_id = $2
                    LIMIT 1
                `, [crewMember.event_id, companyId]);
                
                if (eventAccess.length === 0) {
                    console.log(`Access denied: Crew member ${crewId} belongs to event not assigned to company ${companyId}`);
                    return res.status(403).json({ error: 'Access denied: Cannot delete crew member from this event' });
                }
            } catch (authError) {
                console.error('Delete authorization check error:', authError);
                return res.status(500).json({ error: 'Authorization check failed' });
            }
        }
        
        await run('DELETE FROM crew_members WHERE id = $1', [crewId]);
        console.log(`Crew member ${crewId} deleted successfully`);
        res.json({ message: 'Crew member deleted successfully' });
    } catch (error) {
        console.error('Delete crew error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Approve crew member accreditation (Super Admin only)
app.put('/api/crew/:crewId/approve', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        const { crewId } = req.params;
        
        // Get the crew member first to get their role
        const crewMembers = await query('SELECT * FROM crew_members WHERE id = $1', [crewId]);
        if (crewMembers.length === 0) {
            return res.status(404).json({ error: 'Crew member not found' });
        }
        const crewMember = crewMembers[0];
        
        // Update crew member status (preserve existing access level)
        await run(`
            UPDATE crew_members 
            SET status = 'approved', 
                approved_at = CURRENT_TIMESTAMP
            WHERE id = $1
        `, [crewId]);
        
        const updatedCrewMembers = await query('SELECT * FROM crew_members WHERE id = $1', [crewId]);
        const updatedCrewMember = updatedCrewMembers[0];
        
        const events = await query('SELECT * FROM events WHERE id = $1', [updatedCrewMember.event_id]);
        const event = events[0];
        
        console.log(`📧 Notification sent to ${updatedCrewMember.email}: Your accreditation for ${event.name} has been approved with ${updatedCrewMember.access_level} access!`);
        
        res.json({
            message: `Accreditation approved successfully with ${updatedCrewMember.access_level} access`,
            crewMember: updatedCrewMember
        });
    } catch (error) {
        console.error('Approve crew error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get available roles for crew member creation
app.get('/api/roles', authenticateToken, async (req, res) => {
    try {
        const companyId = req.user.company_id;
        
        if (!companyId) {
            return res.status(400).json({ error: 'Company ID not found' });
        }
        
        // Get roles assigned to this company
        const roles = await query(`
            SELECT r.name
            FROM roles r
            INNER JOIN company_roles cr ON r.name = cr.role_name
            WHERE cr.company_id = $1
            ORDER BY r.name
        `, [companyId]);
        
        const roleNames = roles.map(role => role.name);
        res.json(roleNames);
    } catch (error) {
        console.error('Get roles error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get roles assigned to a specific company
app.get('/api/company/roles', authenticateToken, async (req, res) => {
    try {
        const companyId = req.user.company_id;
        
        if (!companyId) {
            return res.status(400).json({ error: 'Company ID not found' });
        }
        
        const roles = await query(`
            SELECT r.name
            FROM roles r
            INNER JOIN company_roles cr ON r.name = cr.role_name
            WHERE cr.company_id = $1
            ORDER BY r.name
        `, [companyId]);
        
        const roleNames = roles.map(role => role.name);
        res.json(roleNames);
    } catch (error) {
        console.error('Get company roles error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get events assigned to a company
app.get('/api/company/events', authenticateToken, async (req, res) => {
    try {
        const companyId = req.user.company_id;
        
        console.log('Company events request - User ID:', req.user.id, 'Company ID:', companyId);
        
        if (!companyId) {
            console.log('No company ID found for user');
            return res.status(400).json({ error: 'Company ID not found' });
        }
        
        // First try to get events through the event_companies junction table
        let events = await query(`
            SELECT 
                e.id,
                e.name,
                e.location,
                e.start_date,
                e.end_date,
                e.description,
                e.status,
                e.created_at
            FROM events e
            INNER JOIN event_companies ec ON e.id = ec.event_id
            WHERE ec.company_id = $1
            ORDER BY e.start_date ASC
        `, [companyId]);
        
        console.log(`Found ${events.length} events through event_companies junction table`);
        
        // If no events found through junction table, try direct company_id relationship
        if (events.length === 0) {
            console.log('No events found through junction table, trying direct company_id...');
            events = await query(`
                SELECT 
                    id,
                    name,
                    location,
                    start_date,
                    end_date,
                    description,
                    status,
                    created_at
                FROM events
                WHERE company_id = $1
                ORDER BY start_date ASC
            `, [companyId]);
            
            console.log(`Found ${events.length} events through direct company_id relationship`);
        }
        
        console.log(`Total events found for company ${companyId}:`, events.length);
        res.json(events);
    } catch (error) {
        console.error('Get company events error:', error);
        console.error('Error details:', {
            message: error.message,
            code: error.code,
            detail: error.detail,
            hint: error.hint
        });
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

// Get current user info
app.get('/api/auth/me', authenticateToken, async (req, res) => {
    try {
        const users = await query('SELECT * FROM users WHERE id = $1', [req.user.id]);
        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const user = users[0];
        res.json({
            id: user.id,
            email: user.email,
            firstName: user.first_name,
            lastName: user.last_name,
            role: user.role,
            is_super_admin: user.is_super_admin,
            company_id: user.company_id
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Super Admin API Routes

// Get system statistics
app.get('/api/admin/stats', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        const [companiesResult, eventsResult, usersResult, approvalsResult] = await Promise.all([
            query('SELECT COUNT(*) as count FROM companies WHERE status = "active"'),
            query('SELECT COUNT(*) as count FROM events WHERE status = "active"'),
            query('SELECT COUNT(*) as count FROM users'),
            query('SELECT COUNT(*) as count FROM crew_members WHERE status = "pending_approval"')
        ]);
        
        res.json({
            totalCompanies: companiesResult[0].count,
            totalEvents: eventsResult[0].count,
            totalUsers: usersResult[0].count,
            pendingApprovals: approvalsResult[0].count
        });
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get recent activity
app.get('/api/admin/activity', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        // Get recent crew additions, approvals, and user registrations
        const activities = await query(`
            SELECT 
                'approval' as type,
                'New Accreditation Request' as title,
                CONCAT(first_name, ' ', last_name, ' - ', role) as description,
                created_at
            FROM crew_members 
            WHERE created_at >= datetime('now', '-7 days')
            ORDER BY created_at DESC
            LIMIT 10
        `);
        
        res.json(activities);
    } catch (error) {
        console.error('Get activity error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get pending approvals
app.get('/api/admin/approvals', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        const approvals = await query(`
            SELECT 
                cm.id,
                cm.first_name,
                cm.last_name,
                cm.role,
                cm.created_at,
                c.name as company_name,
                e.name as event_name
            FROM crew_members cm
            JOIN events e ON cm.event_id = e.id
            JOIN companies c ON e.company_id = c.id
            WHERE cm.status = 'pending_approval'
            ORDER BY cm.created_at DESC
        `);
        
        res.json(approvals);
    } catch (error) {
        console.error('Get approvals error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get applicant details
app.get('/api/admin/approvals/:crewId/details', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        const { crewId } = req.params;
        
        const details = await query(`
            SELECT 
                cm.*,
                c.name as company_name,
                e.name as event_name,
                e.location as event_location,
                e.start_date as event_start_date,
                e.end_date as event_end_date
            FROM crew_members cm
            JOIN events e ON cm.event_id = e.id
            JOIN companies c ON e.company_id = c.id
            WHERE cm.id = $1
        `, [crewId]);
        
        if (details.length === 0) {
            return res.status(404).json({ error: 'Applicant not found' });
        }
        
        res.json(details[0]);
    } catch (error) {
        console.error('Get applicant details error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Approve accreditation (Super Admin)
app.put('/api/admin/approvals/:crewId/approve', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        const { crewId } = req.params;
        
        // Get the crew member first to get their role
        const crewMembers = await query('SELECT * FROM crew_members WHERE id = $1', [crewId]);
        if (crewMembers.length === 0) {
            return res.status(404).json({ error: 'Crew member not found' });
        }
        const crewMember = crewMembers[0];
        
        // Update crew member status (preserve existing access level)
        await run(`
            UPDATE crew_members 
            SET status = 'approved', 
                approved_at = CURRENT_TIMESTAMP
            WHERE id = $1
        `, [crewId]);
        
        const updatedCrewMembers = await query('SELECT * FROM crew_members WHERE id = $1', [crewId]);
        const updatedCrewMember = updatedCrewMembers[0];
        
        const events = await query('SELECT * FROM events WHERE id = $1', [updatedCrewMember.event_id]);
        const event = events[0];
        
        console.log(`📧 Super Admin approved: Notification sent to ${updatedCrewMember.email}: Your accreditation for ${event.name} has been approved with ${updatedCrewMember.access_level} access!`);
        
        res.json({
            message: `Accreditation approved successfully with ${updatedCrewMember.access_level} access`,
            crewMember: updatedCrewMember
        });
    } catch (error) {
        console.error('Super admin approve error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Reject accreditation (Super Admin)
app.put('/api/admin/approvals/:crewId/reject', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        const { crewId } = req.params;
        
        await run(`
            UPDATE crew_members 
            SET status = 'rejected', approved_at = CURRENT_TIMESTAMP 
            WHERE id = $1
        `, [crewId]);
        
        const crewMembers = await query('SELECT * FROM crew_members WHERE id = $1', [crewId]);
        const crewMember = crewMembers[0];
        
        const events = await query('SELECT * FROM events WHERE id = $1', [crewMember.event_id]);
        const event = events[0];
        
        console.log(`📧 Super Admin rejected: Notification sent to ${crewMember.email}: Your accreditation for ${event.name} has been rejected.`);
        
        res.json({
            message: 'Accreditation rejected successfully',
            crewMember: crewMember
        });
    } catch (error) {
        console.error('Super admin reject error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get all companies
app.get('/api/admin/companies', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        console.log('Fetching companies...');
        
        // First, test if the companies table exists
        const tableCheck = await query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'companies'
            );
        `);
        
        console.log('Companies table exists:', tableCheck[0].exists);
        
        if (!tableCheck[0].exists) {
            return res.status(500).json({ error: 'Companies table does not exist' });
        }
        
        // Check if there are any companies
        const countCheck = await query('SELECT COUNT(*) as count FROM companies');
        console.log('Number of companies:', countCheck[0].count);
        
        // Test simple query first
        console.log('Testing simple companies query...');
        const simpleCompanies = await query('SELECT id, name FROM companies LIMIT 5');
        console.log('Simple query result:', simpleCompanies);
        
        // Test the complex query step by step
        console.log('Testing complex query...');
        const companies = await query(`
            SELECT 
                c.*,
                STRING_AGG(cr.role_name, ', ') as assigned_roles,
                COUNT(DISTINCT COALESCE(e.id, ec.event_id)) as event_count,
                COUNT(DISTINCT u.id) as user_count,
                admin_user.email as admin_email
            FROM companies c
            LEFT JOIN company_roles cr ON c.id = cr.company_id
            LEFT JOIN events e ON c.id = e.company_id
            LEFT JOIN event_companies ec ON c.id = ec.company_id
            LEFT JOIN users u ON c.id = u.company_id
            LEFT JOIN users admin_user ON c.id = admin_user.company_id AND admin_user.role = 'admin'
            GROUP BY c.id, admin_user.email
            ORDER BY c.created_at DESC
        `);
        
        console.log('Companies fetched successfully:', companies.length);
        console.log('First company sample:', companies[0]);
        res.json(companies);
    } catch (error) {
        console.error('Get companies error:', error);
        console.error('Error details:', {
            message: error.message,
            code: error.code,
            detail: error.detail,
            hint: error.hint
        });
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

// Add new company
app.post('/api/admin/companies', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        console.log('Adding new company...');
        console.log('Request body:', req.body);
        
        const { companyName, companyDomain, companyAdminEmail, contactPhone, companyAddress, assignedRoles } = req.body;
        
        // Validate required fields
        if (!companyName || !companyAdminEmail || !assignedRoles || !Array.isArray(assignedRoles) || assignedRoles.length === 0) {
            console.log('Validation failed:', { companyName: !!companyName, companyAdminEmail: !!companyAdminEmail, assignedRoles: assignedRoles });
            return res.status(400).json({ error: 'Missing required fields: company name, admin email, and at least one assigned role' });
        }
        
        console.log('Creating company with data:', { companyName, companyDomain, companyAdminEmail, contactPhone, companyAddress, assignedRoles });
        
        // Create the company
        console.log('Executing company creation query...');
        const result = await run(`
            INSERT INTO companies (name, domain, contact_phone, address)
            VALUES ($1, $2, $3, $4)
            RETURNING id
        `, [companyName, companyDomain, contactPhone, companyAddress]);
        
        const companyId = result.id;
        console.log('Company created with ID:', companyId);
        
        // Assign roles to the company
        console.log('Assigning roles to company...');
        for (const roleName of assignedRoles) {
            console.log('Assigning role:', roleName, 'to company:', companyId);
            await run(`
                INSERT INTO company_roles (company_id, role_name)
                VALUES ($1, $2)
                ON CONFLICT (company_id, role_name) DO NOTHING
            `, [companyId, roleName]);
        }
        
        // Create company admin user
        console.log('Creating company admin user...');
        const bcrypt = require('bcryptjs');
        const adminPassword = bcrypt.hashSync('admin123', 10); // Default password, should be changed
        
        console.log('Creating company admin user:', companyAdminEmail);
        await run(`
            INSERT INTO users (company_id, email, password_hash, first_name, last_name, role)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (email) DO NOTHING
        `, [companyId, companyAdminEmail, adminPassword, 'Company', 'Admin', 'admin']);
        
        // Get the created company with role information
        console.log('Fetching created company details...');
        const companies = await query(`
            SELECT 
                c.*,
                STRING_AGG(cr.role_name, ', ') as assigned_roles
            FROM companies c
            LEFT JOIN company_roles cr ON c.id = cr.company_id
            WHERE c.id = $1
            GROUP BY c.id
        `, [companyId]);
        
        console.log('Company added successfully:', companies[0]);
        res.json({
            message: 'Company added successfully',
            company: companies[0]
        });
    } catch (error) {
        console.error('Add company error:', error);
        console.error('Error details:', {
            message: error.message,
            code: error.code,
            detail: error.detail,
            hint: error.hint,
            stack: error.stack
        });
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

// Get single company
app.get('/api/admin/companies/:companyId', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        const { companyId } = req.params;
        console.log('Getting company with ID:', companyId);
        
        const companies = await query(`
            SELECT 
                c.*,
                STRING_AGG(cr.role_name, ', ') as assigned_roles,
                COUNT(DISTINCT COALESCE(e.id, ec.event_id)) as event_count,
                COUNT(DISTINCT u.id) as user_count,
                admin_user.email as admin_email
            FROM companies c
            LEFT JOIN company_roles cr ON c.id = cr.company_id
            LEFT JOIN events e ON c.id = e.company_id
            LEFT JOIN event_companies ec ON c.id = ec.company_id
            LEFT JOIN users u ON c.id = u.company_id
            LEFT JOIN users admin_user ON c.id = admin_user.company_id AND admin_user.role = 'admin'
            WHERE c.id = $1
            GROUP BY c.id, admin_user.email
        `, [companyId]);
        
        console.log('Query result:', companies);
        
        if (companies.length === 0) {
            return res.status(404).json({ error: 'Company not found' });
        }
        
        res.json(companies[0]);
    } catch (error) {
        console.error('Get company error:', error);
        console.error('Error details:', {
            message: error.message,
            code: error.code,
            detail: error.detail,
            hint: error.hint,
            stack: error.stack
        });
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

// Update company
app.put('/api/admin/companies/:companyId', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        console.log('Updating company...');
        console.log('Request params:', req.params);
        console.log('Request body:', req.body);
        
        const { companyId } = req.params;
        const { companyName, companyDomain, companyAdminEmail, contactPhone, companyAddress, assignedRoles } = req.body;
        
        console.log('Parsed data:', { companyId, companyName, companyDomain, companyAdminEmail, contactPhone, companyAddress, assignedRoles });
        
        // Validate required fields
        if (!companyName || !companyAdminEmail || !assignedRoles || !Array.isArray(assignedRoles) || assignedRoles.length === 0) {
            console.log('Validation failed:', { companyName: !!companyName, companyAdminEmail: !!companyAdminEmail, assignedRoles: assignedRoles });
            return res.status(400).json({ error: 'Missing required fields: company name, admin email, and at least one assigned role' });
        }
        
        console.log('Updating company in database...');
        // Update the company
        await run(`
            UPDATE companies 
            SET name = $1, domain = $2, contact_phone = $3, address = $4
            WHERE id = $5
        `, [companyName, companyDomain, contactPhone, companyAddress, companyId]);
        
        console.log('Company updated, now updating roles...');
        // Update company roles (remove all existing and add new ones)
        await run('DELETE FROM company_roles WHERE company_id = $1', [companyId]);
        
        for (const roleName of assignedRoles) {
            console.log('Assigning role:', roleName, 'to company:', companyId);
            await run(`
                INSERT INTO company_roles (company_id, role_name)
                VALUES ($1, $2)
            `, [companyId, roleName]);
        }
        
        console.log('Roles updated, now updating admin user...');
        // Update or create company admin user
        const bcrypt = require('bcryptjs');
        const adminPassword = bcrypt.hashSync('admin123', 10); // Default password, should be changed
        
        await run(`
            INSERT INTO users (company_id, email, password_hash, first_name, last_name, role)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (email) DO UPDATE SET
                company_id = $1,
                password_hash = $3,
                first_name = $4,
                last_name = $5,
                role = $6
        `, [companyId, companyAdminEmail, adminPassword, 'Company', 'Admin', 'admin']);
        
        console.log('Admin user updated, fetching updated company...');
        // Get the updated company with role information
        const companies = await query(`
            SELECT 
                c.*,
                STRING_AGG(cr.role_name, ', ') as assigned_roles,
                COUNT(DISTINCT COALESCE(e.id, ec.event_id)) as event_count,
                COUNT(DISTINCT u.id) as user_count,
                admin_user.email as admin_email
            FROM companies c
            LEFT JOIN company_roles cr ON c.id = cr.company_id
            LEFT JOIN events e ON c.id = e.company_id
            LEFT JOIN event_companies ec ON c.id = ec.company_id
            LEFT JOIN users u ON c.id = u.company_id
            LEFT JOIN users admin_user ON c.id = admin_user.company_id AND admin_user.role = 'admin'
            WHERE c.id = $1
            GROUP BY c.id, admin_user.email
        `, [companyId]);
        
        console.log('Company updated successfully:', companies[0]);
        res.json({
            message: 'Company updated successfully',
            company: companies[0]
        });
    } catch (error) {
        console.error('Update company error:', error);
        console.error('Error details:', {
            message: error.message,
            code: error.code,
            detail: error.detail,
            hint: error.hint,
            stack: error.stack
        });
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

// Add new event
app.post('/api/admin/events', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        const { name, location, start_date, end_date, description, company_ids } = req.body;
        
        // Validate required fields
        if (!name || !location || !start_date || !end_date || !company_ids || !Array.isArray(company_ids) || company_ids.length === 0) {
            return res.status(400).json({ error: 'Missing required fields: name, location, start_date, end_date, and at least one company_id' });
        }
        
        // Use the first company as the primary company_id for the events table
        const primaryCompanyId = company_ids[0];
        
        // Create the event
        const result = await run(`
            INSERT INTO events (company_id, name, location, start_date, end_date, description)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id
        `, [primaryCompanyId, name, location, start_date, end_date, description]);
        
        const eventId = result.id;
        
        // Add all companies to the event_companies junction table
        for (const companyId of company_ids) {
            await run(`
                INSERT INTO event_companies (event_id, company_id)
                VALUES ($1, $2)
                ON CONFLICT (event_id, company_id) DO NOTHING
            `, [eventId, companyId]);
        }
        
        // Get the created event with company information
        const events = await query(`
            SELECT 
                e.*,
                STRING_AGG(c.name, ', ') as company_names
            FROM events e
            LEFT JOIN event_companies ec ON e.id = ec.event_id
            LEFT JOIN companies c ON ec.company_id = c.id
            WHERE e.id = $1
            GROUP BY e.id
        `, [eventId]);
        
        res.json({
            message: 'Event created successfully',
            event: events[0]
        });
    } catch (error) {
        console.error('Add event error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get all events (for super admin)
app.get('/api/admin/events', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        const events = await query(`
            SELECT 
                e.*,
                STRING_AGG(c.name, ', ') as company_names
            FROM events e
            LEFT JOIN event_companies ec ON e.id = ec.event_id
            LEFT JOIN companies c ON ec.company_id = c.id
            GROUP BY e.id
            ORDER BY e.created_at DESC
        `);
        
        res.json(events);
    } catch (error) {
        console.error('Get events error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get all roles (for super admin)
app.get('/api/admin/roles', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        const roles = await query(`
            SELECT 
                id,
                name,
                description
            FROM roles
            ORDER BY name ASC
        `);
        
        res.json(roles);
    } catch (error) {
        console.error('Get roles error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Add new role
app.post('/api/admin/roles', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        console.log('Add role request body:', req.body);
        const { roleName, roleDescription } = req.body;
        
        // Validate required fields
        if (!roleName || !roleDescription) {
            console.log('Missing fields:', { roleName: !!roleName, roleDescription: !!roleDescription });
            return res.status(400).json({ error: 'Missing required fields: role name and description' });
        }
        
        console.log('Attempting to insert role:', { roleName, roleDescription });
        
        // Check if access_level column exists and is required
        const structure = await query(`
            SELECT column_name, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'roles' AND column_name = 'access_level'
        `);
        
        let result;
        if (structure.length > 0 && structure[0].is_nullable === 'NO') {
            // access_level column exists and is NOT NULL, provide a default value
            result = await run(`
                INSERT INTO roles (name, description, access_level)
                VALUES ($1, $2, $3)
                RETURNING id
            `, [roleName, roleDescription, 'STANDARD']);
        } else {
            // access_level column doesn't exist or is nullable, don't include it
            result = await run(`
                INSERT INTO roles (name, description)
                VALUES ($1, $2)
                RETURNING id
            `, [roleName, roleDescription]);
        }
        
        console.log('Role inserted, result:', result);
        const roles = await query('SELECT id, name, description FROM roles WHERE id = $1', [result.id]);
        console.log('Retrieved role:', roles[0]);
        
        res.json({
            message: 'Role added successfully',
            role: roles[0]
        });
    } catch (error) {
        console.error('Add role error details:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({ error: 'Internal server error: ' + error.message });
    }
});

// Update role
app.put('/api/admin/roles/:roleId', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        const { roleId } = req.params;
        const { roleName, roleDescription } = req.body;
        if (!roleName || !roleDescription) {
            return res.status(400).json({ error: 'Missing required fields: role name and description' });
        }
        await run(`
            UPDATE roles 
            SET name = $1, description = $2
            WHERE id = $3
        `, [roleName, roleDescription, roleId]);
        const roles = await query('SELECT id, name, description FROM roles WHERE id = $1', [roleId]);
        res.json({
            message: 'Role updated successfully',
            role: roles[0]
        });
    } catch (error) {
        console.error('Update role error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete role
app.delete('/api/admin/roles/:roleId', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        const { roleId } = req.params;
        
        await run('DELETE FROM roles WHERE id = $1', [roleId]);
        
        res.json({ message: 'Role deleted successfully' });
    } catch (error) {
        console.error('Delete role error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete company
app.delete('/api/admin/companies/:companyId', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        const { companyId } = req.params;
        
        // First, check if this company has events directly assigned to it
        const eventsWithThisCompany = await query('SELECT id, name FROM events WHERE company_id = $1', [companyId]);
        
        if (eventsWithThisCompany.length > 0) {
            // For events that have this company as their primary company_id, 
            // we need to reassign them to another company or handle the constraint
            // For now, we'll prevent deletion if events are directly assigned
            return res.status(400).json({ 
                error: `Cannot delete company. The following events are directly assigned to this company: ${eventsWithThisCompany.map(e => e.name).join(', ')}. Please reassign these events to another company first.`,
                events: eventsWithThisCompany
            });
        }
        
        // Delete in order: crew members -> event associations -> company roles -> users -> company
        // Note: We delete crew members from this company but preserve events
        await run('DELETE FROM crew_members WHERE company_id = $1', [companyId]);
        
        // Remove company from event associations (but keep the events)
        await run('DELETE FROM event_companies WHERE company_id = $1', [companyId]);
        
        // Delete company roles
        await run('DELETE FROM company_roles WHERE company_id = $1', [companyId]);
        
        // Delete users from this company
        await run('DELETE FROM users WHERE company_id = $1', [companyId]);
        
        // Finally delete the company itself
        await run('DELETE FROM companies WHERE id = $1', [companyId]);
        
        res.json({ message: 'Company deleted successfully. Events have been preserved.' });
    } catch (error) {
        console.error('Delete company error:', error);
        console.error('Error details:', {
            message: error.message,
            code: error.code,
            detail: error.detail,
            hint: error.hint
        });
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

// Delete event
app.delete('/api/admin/events/:id', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        const eventId = req.params.id;
        
        // Delete event companies first
        await run('DELETE FROM event_companies WHERE event_id = $1', [eventId]);
        
        // Delete the event
        await run('DELETE FROM events WHERE id = $1', [eventId]);
        
        res.json({ message: 'Event deleted successfully' });
    } catch (error) {
        console.error('Delete event error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Generate system report
app.post('/api/admin/reports/generate', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        // Get comprehensive system data
        const [companies, events, users, crewMembers] = await Promise.all([
            query('SELECT * FROM companies ORDER BY created_at DESC'),
            query('SELECT * FROM events ORDER BY start_date DESC'),
            query('SELECT * FROM users ORDER BY created_at DESC'),
            query('SELECT * FROM crew_members ORDER BY created_at DESC')
        ]);
        
        // Generate PDF report (simplified for MVP)
        const reportData = {
            generatedAt: new Date().toISOString(),
            summary: {
                totalCompanies: companies.length,
                totalEvents: events.length,
                totalUsers: users.length,
                totalCrewMembers: crewMembers.length
            },
            companies: companies,
            events: events,
            users: users,
            crewMembers: crewMembers
        };
        
        // For MVP, return JSON data (in production, generate actual PDF)
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="youshallpass-report-${new Date().toISOString().split('T')[0]}.json"`);
        res.json(reportData);
        
    } catch (error) {
        console.error('Generate report error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Frontend routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/signin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'signin', 'index.html'));
});

app.get('/events', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'events', 'index.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard', 'index.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html'));
});

app.get('/admin/event-detail', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin', 'event-detail.html'));
});

// Debug route to show environment variables
app.get('/debug-env', (req, res) => {
    res.json({
        message: 'Environment variables debug',
        env: {
            NODE_ENV: process.env.NODE_ENV,
            DATABASE_URL: process.env.DATABASE_URL ? 'SET' : 'NOT SET',
            DATABASE_URL_LENGTH: process.env.DATABASE_URL ? process.env.DATABASE_URL.length : 0,
            SUPABASE_KEY: process.env.SUPABASE_KEY ? 'SET' : 'NOT SET',
            SUPABASE_KEY_LENGTH: process.env.SUPABASE_KEY ? process.env.SUPABASE_KEY.length : 0,
            ALL_ENV_KEYS: Object.keys(process.env).filter(key => key.includes('DATABASE') || key.includes('SUPABASE'))
        }
    });
});

// Get event details (for super admin)
app.get('/api/admin/events/:eventId', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        const { eventId } = req.params;
        
        const events = await query(`
            SELECT 
                e.*,
                c.name as company_name
            FROM events e
            LEFT JOIN companies c ON e.company_id = c.id
            WHERE e.id = $1
        `, [eventId]);
        
        if (events.length === 0) {
            return res.status(404).json({ error: 'Event not found' });
        }
        
        res.json(events[0]);
    } catch (error) {
        console.error('Get event details error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update event (for super admin)
app.put('/api/admin/events/:eventId', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        const { eventId } = req.params;
        const { name, location, start_date, end_date, description, status } = req.body;
        
        await run(`
            UPDATE events 
            SET name = $1, location = $2, start_date = $3, end_date = $4, description = $5, status = $6, updated_at = CURRENT_TIMESTAMP
            WHERE id = $7
        `, [name, location, start_date, end_date, description, status, eventId]);
        
        const events = await query('SELECT * FROM events WHERE id = $1', [eventId]);
        
        res.json({
            message: 'Event updated successfully',
            event: events[0]
        });
    } catch (error) {
        console.error('Update event error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Cancel event (for super admin)
app.put('/api/admin/events/:eventId/cancel', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        const { eventId } = req.params;
        
        await run(`
            UPDATE events 
            SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
        `, [eventId]);
        
        const events = await query('SELECT * FROM events WHERE id = $1', [eventId]);
        
        res.json({
            message: 'Event cancelled successfully',
            event: events[0]
        });
    } catch (error) {
        console.error('Cancel event error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get companies assigned to event
app.get('/api/admin/events/:eventId/companies', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        const { eventId } = req.params;
        
        const companies = await query(`
            SELECT 
                c.id,
                c.name,
                c.domain,
                c.contact_email,
                ec.assigned_at
            FROM event_companies ec
            JOIN companies c ON ec.company_id = c.id
            WHERE ec.event_id = $1
            ORDER BY ec.assigned_at DESC
        `, [eventId]);
        
        res.json(companies);
    } catch (error) {
        console.error('Get event companies error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Assign company to event
app.post('/api/admin/events/:eventId/companies', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        const { eventId } = req.params;
        const { company_id } = req.body;
        
        // Check if assignment already exists
        const existing = await query(`
            SELECT id FROM event_companies 
            WHERE event_id = $1 AND company_id = $2
        `, [eventId, company_id]);
        
        if (existing.length > 0) {
            return res.status(400).json({ error: 'Company is already assigned to this event' });
        }
        
        // Add the assignment
        await run(`
            INSERT INTO event_companies (event_id, company_id)
            VALUES ($1, $2)
        `, [eventId, company_id]);
        
        // Get the assigned company details
        const companies = await query(`
            SELECT 
                c.id,
                c.name,
                c.domain,
                c.contact_email,
                ec.assigned_at
            FROM event_companies ec
            JOIN companies c ON ec.company_id = c.id
            WHERE ec.event_id = $1 AND ec.company_id = $2
        `, [eventId, company_id]);
        
        res.json({
            message: 'Company assigned to event successfully',
            company: companies[0]
        });
    } catch (error) {
        console.error('Assign company to event error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Remove company from event
app.delete('/api/admin/events/:eventId/companies/:companyId', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        const { eventId, companyId } = req.params;
        
        await run(`
            DELETE FROM event_companies 
            WHERE event_id = $1 AND company_id = $2
        `, [eventId, companyId]);
        
        res.json({
            message: 'Company removed from event successfully'
        });
    } catch (error) {
        console.error('Remove company from event error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get crew approvals for a specific event
app.get('/api/admin/events/:eventId/crew-approvals', authenticateToken, async (req, res) => {
    try {
        const { eventId } = req.params;
        const companyId = req.user.company_id;
        const isSuperAdmin = req.user.is_super_admin;

        let approvals;
        if (isSuperAdmin) {
            approvals = await query(`
                SELECT 
                    cm.id,
                    cm.first_name,
                    cm.last_name,
                    cm.email,
                    cm.role,
                    cm.access_level,
                    cm.status,
                    cm.created_at,
                    cm.approved_at,
                    cm.company_id,
                    c.name as company_name
                FROM crew_members cm
                LEFT JOIN companies c ON cm.company_id = c.id
                WHERE cm.event_id = $1 AND cm.status = 'pending_approval'
                ORDER BY cm.created_at DESC
            `, [eventId]);
        } else {
            approvals = await query(`
                SELECT 
                    cm.id,
                    cm.first_name,
                    cm.last_name,
                    cm.email,
                    cm.role,
                    cm.access_level,
                    cm.status,
                    cm.created_at,
                    cm.approved_at
                FROM crew_members cm
                WHERE cm.event_id = $1 AND cm.status = 'pending_approval' AND cm.company_id = $2
                ORDER BY cm.created_at DESC
            `, [eventId, companyId]);
        }
        res.json(approvals);
    } catch (error) {
        console.error('Get event crew approvals error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update crew member access level
app.put('/api/admin/crew/:crewId/access-level', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        const { crewId } = req.params;
        const { access_level } = req.body;
        
        await run(`
            UPDATE crew_members 
            SET access_level = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
        `, [access_level, crewId]);
        
        const crewMembers = await query('SELECT * FROM crew_members WHERE id = $1', [crewId]);
        
        res.json({
            message: 'Access level updated successfully',
            crewMember: crewMembers[0]
        });
    } catch (error) {
        console.error('Update access level error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get crew member details
app.get('/api/admin/crew/:crewId/details', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        const { crewId } = req.params;
        
        const details = await query(`
            SELECT 
                cm.*,
                e.name as event_name,
                e.location as event_location,
                e.start_date as event_start_date,
                e.end_date as event_end_date,
                c.name as company_name
            FROM crew_members cm
            JOIN events e ON cm.event_id = e.id
            LEFT JOIN companies c ON cm.company_id = c.id
            WHERE cm.id = $1
        `, [crewId]);
        
        if (details.length === 0) {
            return res.status(404).json({ error: 'Crew member not found' });
        }
        
        res.json(details[0]);
    } catch (error) {
        console.error('Get crew details error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Generate individual badge PDF (A5 format)
app.get('/api/admin/crew/:crewId/badge/pdf', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        const { crewId } = req.params;
        const { eventId } = req.query;
        
        // Get crew member details
        const crewDetails = await query(`
            SELECT 
                cm.*,
                e.name as event_name,
                e.location as event_location,
                e.start_date as event_start_date,
                e.end_date as event_end_date,
                c.name as company_name
            FROM crew_members cm
            JOIN events e ON cm.event_id = e.id
            LEFT JOIN companies c ON cm.company_id = c.id
            WHERE cm.id = $1 AND cm.status = 'approved'
        `, [crewId]);
        
        if (crewDetails.length === 0) {
            return res.status(404).json({ error: 'Approved crew member not found' });
        }
        
        const crewMember = crewDetails[0];
        const pdfGenerator = require('./services/pdfGenerator');
        
        console.log('Generating A5 badge for crew member:', crewMember.id, crewMember.first_name, crewMember.last_name);
        
        // Generate badge PDF (custom if available, default otherwise)
        const pdfBuffer = await pdfGenerator.generateCustomBadge(crewMember, crewMember);
        
        console.log('PDF generated successfully, buffer size:', pdfBuffer.length);
        
        // Set response headers for PDF download
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="badge_${crewMember.first_name}_${crewMember.last_name}_${crewMember.badge_number}.pdf"`);
        res.setHeader('Content-Length', pdfBuffer.length);
        
        // Send the PDF buffer
        res.send(pdfBuffer);
        
    } catch (error) {
        console.error('Generate badge PDF error:', error);
        console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            crewMemberId: req.params.crewId
        });
        res.status(500).json({ error: 'Failed to generate badge PDF: ' + error.message });
    }
});

// Generate individual badge PDF using custom template (A5 format)
app.get('/api/admin/crew/:crewId/badge/custom-pdf', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        const { crewId } = req.params;
        const { eventId } = req.query;
        
        // Get crew member details with event info
        const crewDetails = await query(`
            SELECT 
                cm.*,
                e.name as event_name,
                e.location as event_location,
                e.start_date as event_start_date,
                e.end_date as event_end_date,
                e.use_custom_badge,
                e.custom_badge_template_path,
                e.custom_badge_field_mapping,
                e.badge_template_name,
                c.name as company_name
            FROM crew_members cm
            JOIN events e ON cm.event_id = e.id
            LEFT JOIN companies c ON cm.company_id = c.id
            WHERE cm.id = $1 AND cm.status = 'approved'
        `, [crewId]);
        
        if (crewDetails.length === 0) {
            return res.status(404).json({ error: 'Approved crew member not found' });
        }
        
        const crewMember = crewDetails[0];
        const pdfGenerator = require('./services/pdfGenerator');
        
        console.log('Generating custom badge for crew member:', crewMember.id, crewMember.first_name, crewMember.last_name);
        console.log('Event has custom template:', crewMember.use_custom_badge);
        
        // Generate custom badge PDF
        const pdfBuffer = await pdfGenerator.generateCustomBadge(crewMember, crewMember);
        
        console.log('Custom PDF generated successfully, buffer size:', pdfBuffer.length);
        
        // Set response headers for PDF download
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="badge_${crewMember.first_name}_${crewMember.last_name}_${crewMember.badge_number}_custom.pdf"`);
        res.setHeader('Content-Length', pdfBuffer.length);
        
        // Send the PDF buffer
        res.send(pdfBuffer);
        
    } catch (error) {
        console.error('Error generating custom badge PDF:', error);
        res.status(500).json({ error: 'Failed to generate custom badge PDF: ' + error.message });
    }
});

// Upload custom badge template for an event
app.post('/api/admin/events/:eventId/badge-template', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        const { eventId } = req.params;
        const { templateName, useCustomBadge, fieldMapping } = req.body;
        
        // For now, we'll just update the event with template configuration
        // In a full implementation, you'd handle file upload here
        await run(`
            UPDATE events 
            SET 
                use_custom_badge = $1,
                badge_template_name = $2,
                custom_badge_field_mapping = $3,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $4
        `, [useCustomBadge, templateName, JSON.stringify(fieldMapping), eventId]);
        
        res.json({ 
            success: true, 
            message: 'Badge template configuration updated successfully' 
        });
        
    } catch (error) {
        console.error('Error updating badge template:', error);
        res.status(500).json({ error: 'Failed to update badge template: ' + error.message });
    }
});

// Get badge template configuration for an event
app.get('/api/admin/events/:eventId/badge-template', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        const { eventId } = req.params;
        
        const result = await query(`
            SELECT 
                use_custom_badge,
                custom_badge_template_path,
                custom_badge_field_mapping,
                badge_template_name
            FROM events 
            WHERE id = $1
        `, [eventId]);
        
        if (result.length === 0) {
            return res.status(404).json({ error: 'Event not found' });
        }
        
        const template = result[0];
        
        res.json({
            useCustomBadge: template.use_custom_badge || false,
            templatePath: template.custom_badge_template_path,
            fieldMapping: template.custom_badge_field_mapping || {},
            templateName: template.badge_template_name
        });
        
    } catch (error) {
        console.error('Error fetching badge template:', error);
        res.status(500).json({ error: 'Failed to fetch badge template: ' + error.message });
    }
});

// Cleanup events endpoint - delete ALL events
app.post('/api/admin/cleanup-events', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        console.log('Starting event cleanup - deleting ALL events...');
        
        // First, delete all crew members associated with events
        const crewResult = await run('DELETE FROM crew_members');
        console.log(`Deleted ${crewResult.rowCount} crew members`);
        
        // Delete all event-company associations
        const eventCompaniesResult = await run('DELETE FROM event_companies');
        console.log(`Deleted ${eventCompaniesResult.rowCount} event-company associations`);
        
        // Delete ALL events
        const eventsResult = await run('DELETE FROM events');
        console.log(`Deleted ${eventsResult.rowCount} events`);
        
        // Show remaining events (should be 0)
        const remainingEvents = await query('SELECT id, name, status FROM events ORDER BY created_at ASC');
        console.log('Remaining events:', remainingEvents.length);
        
        res.json({
            message: 'ALL events deleted successfully',
            deletedEvents: eventsResult.rowCount,
            remainingEvents: remainingEvents
        });
        
    } catch (error) {
        console.error('Error during cleanup:', error);
        res.status(500).json({ error: 'Cleanup failed', details: error.message });
    }
});

// Get approved crew members for events with company filter
app.get('/api/admin/events/:eventId/approved-crew', authenticateToken, async (req, res) => {
    try {
        const { eventId } = req.params;
        let company_id = req.query.company_id;
        const isSuperAdmin = req.user.is_super_admin;

        // For non-super-admins, always use their own company_id
        if (!isSuperAdmin) {
            company_id = req.user.company_id;
        }

        let queryText = `
            SELECT 
                cm.id,
                cm.first_name,
                cm.last_name,
                cm.email,
                cm.role,
                cm.access_level,
                cm.status,
                cm.created_at,
                cm.approved_at,
                c.name as company_name,
                c.id as company_id
            FROM crew_members cm
            LEFT JOIN companies c ON cm.company_id = c.id
            WHERE cm.event_id = $1 AND cm.status = 'approved'
        `;
        let queryParams = [eventId];
        if (company_id) {
            queryText += ' AND cm.company_id = $2';
            queryParams.push(company_id);
        }
        queryText += ' ORDER BY cm.approved_at DESC';
        const approvedCrew = await query(queryText, queryParams);
        res.json(approvedCrew);
    } catch (error) {
        console.error('Get approved crew error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Debug endpoint to check roles table
app.get('/api/debug/roles', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        // Check if roles table exists
        const tableExists = await query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'roles'
            );
        `);
        
        if (!tableExists[0].exists) {
            return res.json({ error: 'Roles table does not exist' });
        }
        
        // Get table structure
        const structure = await query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'roles'
            ORDER BY ordinal_position;
        `);
        
        // Get all roles
        const roles = await query('SELECT * FROM roles ORDER BY id');
        
        res.json({
            tableExists: tableExists[0].exists,
            structure,
            roles,
            count: roles.length
        });
    } catch (error) {
        console.error('Debug roles error:', error);
        res.status(500).json({ error: 'Debug error: ' + error.message });
    }
});

// Migration endpoint to update database schema
app.post('/api/admin/migrate', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        console.log('Starting database migration...');
        
        // First, check if roles table exists and get its current structure
        const tableExists = await query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'roles'
            );
        `);
        
        if (!tableExists[0].exists) {
            return res.status(400).json({ error: 'Roles table does not exist' });
        }
        
        // Get current table structure
        const structure = await query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'roles'
            ORDER BY ordinal_position;
        `);
        
        console.log('Current roles table structure:', structure);
        
        // Add description column if it doesn't exist
        const hasDescription = structure.some(col => col.column_name === 'description');
        if (!hasDescription) {
            await run(`
                ALTER TABLE roles ADD COLUMN description TEXT DEFAULT 'No description available'
            `);
            console.log('Added description column');
        }
        
        // Check if access_level column exists and is not null
        const hasAccessLevel = structure.some(col => col.column_name === 'access_level');
        const accessLevelNotNull = structure.find(col => col.column_name === 'access_level')?.is_nullable === 'NO';
        
        if (hasAccessLevel && accessLevelNotNull) {
            // Make access_level nullable or add default value
            await run(`
                ALTER TABLE roles ALTER COLUMN access_level DROP NOT NULL
            `);
            console.log('Made access_level nullable');
        }
        
        // Check if name column has unique constraint
        const uniqueConstraints = await query(`
            SELECT constraint_name 
            FROM information_schema.table_constraints 
            WHERE table_name = 'roles' 
            AND constraint_type = 'UNIQUE'
        `);
        
        const hasNameUnique = uniqueConstraints.some(constraint => 
            constraint.constraint_name.includes('name') || constraint.constraint_name.includes('roles')
        );
        
        if (!hasNameUnique) {
            // Add unique constraint on name column
            await run(`
                ALTER TABLE roles ADD CONSTRAINT roles_name_unique UNIQUE (name)
            `);
            console.log('Added unique constraint on name column');
        }
        
        // Update existing roles with descriptions (without ON CONFLICT for now)
        const defaultRoles = [
            { name: 'technical_director', description: 'Oversees technical operations and equipment setup for events' },
            { name: 'media_personnel', description: 'Handles media coverage, photography, and video recording' },
            { name: 'security_officer', description: 'Manages event security and access control' },
            { name: 'logistics_coordinator', description: 'Coordinates event logistics, transportation, and setup' },
            { name: 'medical_staff', description: 'Provides medical support and emergency response during events' },
            { name: 'catering_staff', description: 'Manages food and beverage services for events' },
            { name: 'cleanup_crew', description: 'Handles post-event cleanup and venue restoration' },
            { name: 'volunteer_coordinator', description: 'Manages volunteer recruitment and coordination' }
        ];

        for (const role of defaultRoles) {
            // Check if role exists first
            const existingRole = await query('SELECT id FROM roles WHERE name = $1', [role.name]);
            if (existingRole.length > 0) {
                // Update existing role
                await run(`
                    UPDATE roles SET description = $1 WHERE name = $2
                `, [role.description, role.name]);
            } else {
                // Insert new role
                await run(`
                    INSERT INTO roles (name, description) VALUES ($1, $2)
                `, [role.name, role.description]);
            }
        }
        
        // Link existing events to companies through event_companies junction table
        console.log('Linking events to companies...');
        const events = await query('SELECT id, company_id FROM events WHERE company_id IS NOT NULL');
        
        for (const event of events) {
            // Check if link already exists
            const existingLink = await query(`
                SELECT id FROM event_companies 
                WHERE event_id = $1 AND company_id = $2
            `, [event.id, event.company_id]);
            
            if (existingLink.length === 0) {
                await run(`
                    INSERT INTO event_companies (event_id, company_id)
                    VALUES ($1, $2)
                `, [event.id, event.company_id]);
                console.log(`Linked event ${event.id} to company ${event.company_id}`);
            }
        }
        
        console.log('Database migration completed successfully!');
        res.json({ message: 'Database migration completed successfully' });
    } catch (error) {
        console.error('Migration error:', error);
        res.status(500).json({ error: 'Migration failed: ' + error.message });
    }
});

// Test endpoint to check crew_members table
app.get('/api/debug/crew-members', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        console.log('Testing crew_members table...');
        
        // Check if crew_members table exists
        const tableExists = await query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'crew_members'
            );
        `);
        
        if (!tableExists[0].exists) {
            return res.json({ error: 'crew_members table does not exist' });
        }
        
        // Get table structure
        const structure = await query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'crew_members'
            ORDER BY ordinal_position;
        `);
        
        // Get sample data
        const sampleData = await query('SELECT * FROM crew_members LIMIT 5');
        
        // Get count by status
        const statusCount = await query(`
            SELECT status, COUNT(*) as count 
            FROM crew_members 
            GROUP BY status
        `);
        
        res.json({
            tableExists: tableExists[0].exists,
            structure,
            sampleData,
            statusCount,
            totalCount: sampleData.length
        });
    } catch (error) {
        console.error('Debug crew_members error:', error);
        res.status(500).json({ error: 'Debug error: ' + error.message });
    }
});

// Simple test endpoint for companies (Super Admin only)
app.get('/test-companies', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        console.log('Testing companies endpoint...');
        
        const companies = await query('SELECT id, name, domain FROM companies LIMIT 5');
        console.log('Test companies result:', companies);
        
        res.json({
            message: 'Companies test successful',
            companies: companies,
            count: companies.length
        });
    } catch (error) {
        console.error('Test companies error:', error);
        res.status(500).json({ 
            error: 'Test companies failed', 
            details: error.message,
            code: error.code
        });
    }
});

// Simple health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        message: 'Server is running', 
        timestamp: new Date().toISOString(),
        status: 'ok'
    });
});

// Public debug endpoint to check company data relationships (no auth required)
app.get('/debug-public', async (req, res) => {
    try {
        console.log('🔍 Running public debug check...');
        
        // Get basic counts and relationships
        const companies = await query('SELECT id, name FROM companies ORDER BY id');
        const events = await query('SELECT id, name, company_id FROM events ORDER BY id');
        const eventCompanies = await query('SELECT event_id, company_id FROM event_companies ORDER BY event_id');
        const users = await query('SELECT id, email, company_id, is_super_admin FROM users ORDER BY id');
        const crewCount = await query('SELECT COUNT(*) as count FROM crew_members');
        
        // Check for data isolation issues
        const issues = [];
        
        // Events without company relationships
        const eventsWithoutCompany = events.filter(e => !e.company_id);
        if (eventsWithoutCompany.length > 0) {
            issues.push({
                type: 'events_without_company',
                count: eventsWithoutCompany.length,
                data: eventsWithoutCompany.map(e => ({ id: e.id, name: e.name }))
            });
        }
        
        // Users without company (excluding super admins)
        const usersWithoutCompany = users.filter(u => !u.company_id && !u.is_super_admin);
        if (usersWithoutCompany.length > 0) {
            issues.push({
                type: 'users_without_company',
                count: usersWithoutCompany.length,
                data: usersWithoutCompany.map(u => ({ id: u.id, email: u.email }))
            });
        }
        
        // Check for duplicate event assignments (MAJOR SECURITY ISSUE)
        const eventAssignmentCounts = {};
        eventCompanies.forEach(ec => {
            eventAssignmentCounts[ec.event_id] = (eventAssignmentCounts[ec.event_id] || 0) + 1;
        });
        const duplicateAssignments = Object.entries(eventAssignmentCounts)
            .filter(([eventId, count]) => count > 1)
            .map(([eventId, count]) => ({
                event_id: parseInt(eventId),
                assignment_count: count,
                event_name: events.find(e => e.id === parseInt(eventId))?.name
            }));
        
        if (duplicateAssignments.length > 0) {
            issues.push({
                type: 'duplicate_event_assignments',
                count: duplicateAssignments.length,
                description: 'Events assigned to multiple companies (causes cross-company data leakage)',
                data: duplicateAssignments
            });
        }
        
        // Check if junction table has entries
        const junctionTableEntries = eventCompanies.length;
        
        res.json({
            timestamp: new Date().toISOString(),
            summary: {
                companies: companies.length,
                events: events.length,
                users: users.length,
                crew_members: crewCount[0].count,
                event_company_links: junctionTableEntries,
                issues_found: issues.length
            },
            companies: companies,
            events: events.map(e => ({ 
                id: e.id, 
                name: e.name, 
                company_id: e.company_id,
                has_junction_link: eventCompanies.some(ec => ec.event_id === e.id),
                junction_assignment_count: eventCompanies.filter(ec => ec.event_id === e.id).length
            })),
            event_companies: eventCompanies,
            users: users.map(u => ({
                id: u.id,
                email: u.email,
                company_id: u.company_id,
                is_super_admin: u.is_super_admin
            })),
            issues: issues,
            recommendations: issues.length === 0 ? 
                ['✅ Basic data structure looks good'] : 
                [
                    '⚠️ Data isolation issues detected',
                    'CRITICAL: Remove duplicate event assignments immediately',
                    'Run /fix-duplicate-assignments to resolve'
                ]
        });
    } catch (error) {
        console.error('Public debug error:', error);
        res.status(500).json({ 
            error: 'Debug error: ' + error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Fix duplicate event assignments (PUBLIC - immediate security fix needed)
app.post('/fix-duplicate-assignments', async (req, res) => {
    try {
        console.log('🛠️ Fixing duplicate event assignments...');
        
        // Get all duplicate assignments
        const eventCompanies = await query('SELECT event_id, company_id FROM event_companies ORDER BY event_id, company_id');
        const events = await query('SELECT id, name, company_id FROM events');
        
        const duplicateEvents = {};
        eventCompanies.forEach(ec => {
            if (!duplicateEvents[ec.event_id]) {
                duplicateEvents[ec.event_id] = [];
            }
            duplicateEvents[ec.event_id].push(ec.company_id);
        });
        
        const fixes = [];
        
        for (const [eventId, companyIds] of Object.entries(duplicateEvents)) {
            if (companyIds.length > 1) {
                const event = events.find(e => e.id === parseInt(eventId));
                const primaryCompanyId = event.company_id; // Use the direct relationship as primary
                
                console.log(`Fixing event ${eventId} (${event.name}): keeping company ${primaryCompanyId}, removing others`);
                
                // Remove all assignments except the primary one
                await run(`
                    DELETE FROM event_companies 
                    WHERE event_id = $1 AND company_id != $2
                `, [eventId, primaryCompanyId]);
                
                fixes.push({
                    event_id: parseInt(eventId),
                    event_name: event.name,
                    kept_company_id: primaryCompanyId,
                    removed_companies: companyIds.filter(cId => cId !== primaryCompanyId)
                });
            }
        }
        
        // Verify the fix
        const remainingDuplicates = await query(`
            SELECT event_id, COUNT(*) as count 
            FROM event_companies 
            GROUP BY event_id 
            HAVING COUNT(*) > 1
        `);
        
        res.json({
            message: 'Duplicate event assignments fixed successfully',
            fixes_applied: fixes,
            remaining_duplicates: remainingDuplicates.length,
            timestamp: new Date().toISOString(),
            security_status: remainingDuplicates.length === 0 ? 
                '✅ Cross-company data leakage resolved' : 
                '⚠️ Some duplicates may still exist'
        });
        
    } catch (error) {
        console.error('Fix duplicates error:', error);
        res.status(500).json({ 
            error: 'Fix failed: ' + error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Add company_id to crew_members table and fix company isolation (CRITICAL SECURITY FIX)
app.post('/fix-crew-company-isolation', async (req, res) => {
    try {
        console.log('🛡️ Implementing crew company isolation...');
        
        const fixes = [];
        
        // Step 1: Add company_id column to crew_members table if it doesn't exist
        try {
            await run(`
                DO $$ BEGIN
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='crew_members' AND column_name='company_id') THEN
                        ALTER TABLE crew_members ADD COLUMN company_id INTEGER REFERENCES companies(id);
                    END IF;
                END $$;
            `);
            fixes.push('✅ Added company_id column to crew_members table');
        } catch (error) {
            fixes.push('⚠️ company_id column may already exist: ' + error.message);
        }
        
        // Step 2: Update existing crew members with company_id based on their event's primary company
        const crewWithoutCompany = await query(`
            SELECT cm.id, cm.event_id, e.company_id as event_company_id
            FROM crew_members cm
            JOIN events e ON cm.event_id = e.id
            WHERE cm.company_id IS NULL
        `);
        
        for (const crew of crewWithoutCompany) {
            await run(`
                UPDATE crew_members 
                SET company_id = $1 
                WHERE id = $2
            `, [crew.event_company_id, crew.id]);
        }
        
        fixes.push(`✅ Updated ${crewWithoutCompany.length} crew members with company_id`);
        
        // Step 3: Create index for better performance
        try {
            await run(`
                CREATE INDEX IF NOT EXISTS idx_crew_members_company_id ON crew_members(company_id);
            `);
            fixes.push('✅ Created index on crew_members.company_id');
        } catch (error) {
            fixes.push('⚠️ Index creation: ' + error.message);
        }
        
        // Step 4: Verify the fix
        const crewStats = await query(`
            SELECT 
                company_id,
                COUNT(*) as crew_count
            FROM crew_members 
            WHERE company_id IS NOT NULL
            GROUP BY company_id
            ORDER BY company_id
        `);
        
        const orphanedCrew = await query(`
            SELECT COUNT(*) as count 
            FROM crew_members 
            WHERE company_id IS NULL
        `);
        
        res.json({
            message: 'Crew company isolation implemented successfully',
            fixes_applied: fixes,
            crew_stats: crewStats,
            orphaned_crew: orphanedCrew[0].count,
            timestamp: new Date().toISOString(),
            security_status: orphanedCrew[0].count === 0 ? 
                '✅ All crew members now have company isolation' : 
                '⚠️ Some crew members still need company assignment',
            next_step: 'Update API endpoints to filter by company_id'
        });
        
    } catch (error) {
        console.error('Fix crew isolation error:', error);
        res.status(500).json({ 
            error: 'Fix failed: ' + error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something broke!' });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

// Initialize database and start server
const startServer = async () => {
    try {
        await initDatabase();
        console.log('✅ Database initialized successfully');
        
        // For Vercel serverless, don't call app.listen
        if (process.env.NODE_ENV !== 'production') {
            app.listen(port, () => {
                console.log(`🚀 YouShallPass MVP Server running at http://localhost:${port}`);
                console.log(`📊 Admin login: admin@youshallpass.com / admin123`);
                console.log(`📁 PDF badges will be saved to: public/badges/`);
            });
        } else {
            console.log('🚀 YouShallPass MVP Server ready for Vercel deployment');
            console.log(`📊 Admin login: admin@youshallpass.com / admin123`);
        }
    } catch (error) {
        console.error('Failed to start server:', error);
        if (process.env.NODE_ENV !== 'production') {
            process.exit(1);
        }
    }
};

// Check migration status - specifically for company_id column
app.get('/check-migration-status', async (req, res) => {
    try {
        console.log('🔍 Checking migration status...');
        
        // Check if company_id column exists in crew_members
        const columnExists = await query(`
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'crew_members' AND column_name = 'company_id'
        `);
        
        const migrationApplied = columnExists.length > 0;
        
        if (migrationApplied) {
            // Get crew members with company assignments
            const crewWithCompany = await query(`
                SELECT 
                    cm.id,
                    cm.first_name,
                    cm.last_name,
                    cm.email,
                    cm.company_id,
                    c.name as company_name,
                    cm.event_id,
                    e.name as event_name
                FROM crew_members cm
                LEFT JOIN companies c ON cm.company_id = c.id
                LEFT JOIN events e ON cm.event_id = e.id
                ORDER BY cm.id
            `);
            
            const crewWithoutCompany = crewWithCompany.filter(c => !c.company_id);
            const crewStats = {};
            crewWithCompany.forEach(c => {
                if (c.company_id) {
                    crewStats[c.company_id] = (crewStats[c.company_id] || 0) + 1;
                }
            });
            
            res.json({
                migration_status: '✅ APPLIED',
                company_id_column_exists: true,
                crew_members: {
                    total: crewWithCompany.length,
                    with_company: crewWithCompany.length - crewWithoutCompany.length,
                    without_company: crewWithoutCompany.length,
                    by_company: crewStats
                },
                crew_details: crewWithCompany,
                security_status: crewWithoutCompany.length === 0 ? 
                    '🔒 SECURE - All crew members have company assignments' : 
                    '⚠️ WARNING - Some crew members missing company assignment',
                timestamp: new Date().toISOString()
            });
        } else {
            res.json({
                migration_status: '❌ NOT APPLIED',
                company_id_column_exists: false,
                message: 'Run POST /fix-crew-company-isolation to apply migration',
                security_status: '🚨 VULNERABLE - Cross-company data leakage possible',
                timestamp: new Date().toISOString()
            });
        }
        
    } catch (error) {
        console.error('Migration status check error:', error);
        res.status(500).json({ 
            error: 'Migration status check failed: ' + error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Initialize database on startup
startServer();

// Export for Vercel
module.exports = app;
