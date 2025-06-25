const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const fs = require('fs');
require('dotenv').config();

// Import our modules
const { initDatabase, query, run } = require('./database/schema');
const { generatePDF } = require('./services/pdfGenerator');

const app = express();
const port = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
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
            { id: user.id, email: user.email, role: user.role, is_super_admin: user.is_super_admin },
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
                is_super_admin: user.is_super_admin
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
        const crew = await query(`
            SELECT id, first_name, last_name, email, role, access_level, badge_number, status, created_at
            FROM crew_members 
            WHERE event_id = $1 
            ORDER BY created_at DESC
        `, [eventId]);
        
        res.json(crew);
    } catch (error) {
        console.error('Get crew error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Add crew member
app.post('/api/events/:eventId/crew', authenticateToken, async (req, res) => {
    try {
        const { eventId } = req.params;
        const { firstName, lastName, email, role, photoPath } = req.body;

        // Log incoming data for debugging
        console.log('Add crew member request:', { eventId, firstName, lastName, email, role, photoPath });

        // Validate required fields
        if (!firstName || !lastName || !email || !role) {
            return res.status(400).json({ error: 'Missing required fields' });
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
        const result = await run(`
            INSERT INTO crew_members (event_id, first_name, last_name, email, role, access_level, badge_number)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id
        `, [eventId, firstName, lastName, email, role, 'STANDARD', badgeNumber]);
        console.log('Crew member inserted, result:', result);

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

        // Validate event exists first
        const events = await query('SELECT * FROM events WHERE id = $1', [eventId]);
        if (events.length === 0) {
            return res.status(404).json({ error: 'Event not found' });
        }
        const event = events[0];

        // Get crew members
        const crewMembers = await query(`
            SELECT id, first_name, last_name, role, access_level, badge_number, status
            FROM crew_members 
            WHERE event_id = $1 
            ORDER BY created_at DESC
        `, [eventId]);

        // Generate PDF
        const pdfResult = await pdfGenerator.generateCrewList(crewMembers, event);

        res.json({
            url: pdfResult.url,
            filename: pdfResult.filename
        });
    } catch (error) {
        console.error('Generate crew list error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update crew member status
app.put('/api/crew/:crewId', authenticateToken, async (req, res) => {
    try {
        const { crewId } = req.params;
        const { status } = req.body;

        await run('UPDATE crew_members SET status = $1 WHERE id = $2', [status, crewId]);
        
        const crewMembers = await query('SELECT * FROM crew_members WHERE id = $1', [crewId]);
        res.json(crewMembers[0]);
    } catch (error) {
        console.error('Update crew error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete crew member
app.delete('/api/crew/:crewId', authenticateToken, async (req, res) => {
    try {
        const { crewId } = req.params;
        await run('DELETE FROM crew_members WHERE id = $1', [crewId]);
        res.json({ message: 'Crew member deleted successfully' });
    } catch (error) {
        console.error('Delete crew error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Approve crew member accreditation
app.put('/api/crew/:crewId/approve', authenticateToken, async (req, res) => {
    try {
        const { crewId } = req.params;
        
        // Get the crew member first to get their role
        const crewMembers = await query('SELECT * FROM crew_members WHERE id = $1', [crewId]);
        if (crewMembers.length === 0) {
            return res.status(404).json({ error: 'Crew member not found' });
        }
        const crewMember = crewMembers[0];
        
        // Update crew member status and assign access level
        await run(`
            UPDATE crew_members 
            SET status = 'approved', 
                approved_at = CURRENT_TIMESTAMP,
                access_level = $1
            WHERE id = $2
        `, ['STANDARD', crewId]);
        
        const updatedCrewMembers = await query('SELECT * FROM crew_members WHERE id = $1', [crewId]);
        const updatedCrewMember = updatedCrewMembers[0];
        
        const events = await query('SELECT * FROM events WHERE id = $1', [updatedCrewMember.event_id]);
        const event = events[0];
        
        console.log(`📧 Notification sent to ${updatedCrewMember.email}: Your accreditation for ${event.name} has been approved with STANDARD access!`);
        
        res.json({
            message: 'Accreditation approved successfully with STANDARD access',
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

// Super Admin Middleware
const requireSuperAdmin = (req, res, next) => {
    if (!req.user.is_super_admin) {
        return res.status(403).json({ error: 'Super admin access required' });
    }
    next();
};

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
        
        // Update crew member status and assign access level
        await run(`
            UPDATE crew_members 
            SET status = 'approved', 
                approved_at = CURRENT_TIMESTAMP,
                access_level = $1
            WHERE id = $2
        `, ['STANDARD', crewId]);
        
        const updatedCrewMembers = await query('SELECT * FROM crew_members WHERE id = $1', [crewId]);
        const updatedCrewMember = updatedCrewMembers[0];
        
        const events = await query('SELECT * FROM events WHERE id = $1', [updatedCrewMember.event_id]);
        const event = events[0];
        
        console.log(`📧 Super Admin approved: Notification sent to ${updatedCrewMember.email}: Your accreditation for ${event.name} has been approved with STANDARD access!`);
        
        res.json({
            message: 'Accreditation approved successfully with STANDARD access',
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
        
        // Delete in order: crew members -> events -> users -> company
        await run('DELETE FROM crew_members WHERE event_id IN (SELECT id FROM events WHERE company_id = $1)', [companyId]);
        await run('DELETE FROM events WHERE company_id = $1', [companyId]);
        await run('DELETE FROM users WHERE company_id = $1', [companyId]);
        await run('DELETE FROM roles WHERE company_id = $1', [companyId]);
        await run('DELETE FROM companies WHERE id = $1', [companyId]);
        
        res.json({ message: 'Company and all associated data deleted successfully' });
    } catch (error) {
        console.error('Delete company error:', error);
        res.status(500).json({ error: 'Internal server error' });
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
app.get('/api/admin/events/:eventId/crew-approvals', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        const { eventId } = req.params;
        
        const approvals = await query(`
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
            WHERE cm.event_id = $1 AND cm.status = 'pending_approval'
            ORDER BY cm.created_at DESC
        `, [eventId]);
        
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
                c.name as company_name
            FROM crew_members cm
            JOIN events e ON cm.event_id = e.id
            LEFT JOIN companies c ON e.company_id = c.id
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
app.get('/api/admin/events/:eventId/approved-crew', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        const { eventId } = req.params;
        const { company_id } = req.query; // Optional company filter
        
        console.log('Getting approved crew for event:', eventId);
        console.log('Company filter:', company_id);
        
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
        
        // Add company filter if provided
        if (company_id) {
            queryText += ' AND cm.company_id = $2';
            queryParams.push(company_id);
        }
        
        queryText += ' ORDER BY cm.approved_at DESC';
        
        console.log('Query:', queryText);
        console.log('Query params:', queryParams);
        
        const approvedCrew = await query(queryText, queryParams);
        
        console.log('Approved crew result:', approvedCrew);
        console.log('Approved crew count:', approvedCrew.length);
        
        res.json(approvedCrew);
    } catch (error) {
        console.error('Get approved crew error:', error);
        console.error('Error details:', {
            message: error.message,
            code: error.code,
            detail: error.detail,
            hint: error.hint
        });
        res.status(500).json({ error: 'Internal server error', details: error.message });
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
        
        console.log('Database migration completed successfully!');
        res.json({ message: 'Database migration completed successfully' });
        
    } catch (error) {
        console.error('Migration error:', error);
        res.status(500).json({ error: 'Migration failed: ' + error.message });
    }
});

// Simple test endpoint for companies (no auth required)
app.get('/test-companies', async (req, res) => {
    try {
        console.log('Testing companies endpoint without auth...');
        
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

// Initialize database on startup
startServer();

// Export for Vercel
module.exports = app;
