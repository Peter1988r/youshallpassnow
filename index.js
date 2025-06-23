const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// Import our modules
const { initDatabase, query, run } = require('./database/schema');
const { ROLE_ACCESS_MATRIX } = require('./config/accessMatrix');
const pdfGenerator = require('./services/pdfGenerator');

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
        
        const users = await query('SELECT * FROM users WHERE email = $1', [email]);
        if (users.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = users[0];
        const validPassword = await bcrypt.compare(password, user.password_hash);
        
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role, is_super_admin: user.is_super_admin },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

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
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
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
            SELECT id, first_name, last_name, role, access_level, badge_number, status, created_at
            FROM crew_members 
            WHERE event_id = $1 
            ORDER BY first_name, last_name
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

        // Validate event exists first
        const events = await query('SELECT * FROM events WHERE id = $1', [eventId]);
        if (events.length === 0) {
            return res.status(404).json({ error: 'Event not found' });
        }
        const event = events[0];

        // Get access level from role
        const accessLevel = ROLE_ACCESS_MATRIX[role] || 'RESTRICTED';
        
        // Generate unique badge number
        const badgeNumber = generateBadgeNumber();

        const result = await run(`
            INSERT INTO crew_members (event_id, first_name, last_name, email, role, access_level, badge_number, photo_path)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [eventId, firstName, lastName, email, role, accessLevel, badgeNumber, photoPath || null]);

        // Get the created crew member
        const crewMembers = await query('SELECT * FROM crew_members WHERE id = $1', [result.id]);
        const crewMember = crewMembers[0];

        // Generate PDF badge
        const badgeResult = await pdfGenerator.generateBadge(crewMember, event);

        res.json({
            ...crewMember,
            badgeUrl: badgeResult.url,
            message: 'Employee added successfully. Accreditation is pending approval.'
        });
    } catch (error) {
        console.error('Add crew error:', error);
        res.status(500).json({ error: 'Internal server error' });
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
            ORDER BY first_name, last_name
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
        
        // Update status to approved
        await run(`
            UPDATE crew_members 
            SET status = 'approved', approved_at = CURRENT_TIMESTAMP 
            WHERE id = $1
        `, [crewId]);
        
        // Get the updated crew member
        const crewMembers = await query('SELECT * FROM crew_members WHERE id = $1', [crewId]);
        const crewMember = crewMembers[0];
        
        // Get event details for notification
        const events = await query('SELECT * FROM events WHERE id = $1', [crewMember.event_id]);
        const event = events[0];
        
        // TODO: Send email notification to crew member
        // For MVP, we'll just log the notification
        console.log(`📧 Notification sent to ${crewMember.email}: Your accreditation for ${event.name} has been approved!`);
        
        res.json({
            ...crewMember,
            message: `Accreditation approved. Notification sent to ${crewMember.email}`
        });
    } catch (error) {
        console.error('Approve crew error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get available roles
app.get('/api/roles', (req, res) => {
    const roles = Object.keys(ROLE_ACCESS_MATRIX);
    res.json(roles);
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
            ORDER BY cm.created_at ASC
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
        
        await run(`
            UPDATE crew_members 
            SET status = 'approved', approved_at = CURRENT_TIMESTAMP 
            WHERE id = $1
        `, [crewId]);
        
        const crewMembers = await query('SELECT * FROM crew_members WHERE id = $1', [crewId]);
        const crewMember = crewMembers[0];
        
        const events = await query('SELECT * FROM events WHERE id = $1', [crewMember.event_id]);
        const event = events[0];
        
        console.log(`📧 Super Admin approved: Notification sent to ${crewMember.email}: Your accreditation for ${event.name} has been approved!`);
        
        res.json({
            message: 'Accreditation approved successfully',
            crewMember: crewMember
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
        const companies = await query(`
            SELECT 
                c.*,
                COUNT(DISTINCT e.id) as event_count,
                COUNT(DISTINCT u.id) as user_count
            FROM companies c
            LEFT JOIN events e ON c.id = e.company_id
            LEFT JOIN users u ON c.id = u.company_id
            GROUP BY c.id
            ORDER BY c.created_at DESC
        `);
        
        res.json(companies);
    } catch (error) {
        console.error('Get companies error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Add new company
app.post('/api/admin/companies', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        const { companyName, companyDomain, contactEmail, contactPhone, companyAddress, subscriptionPlan } = req.body;
        
        const result = await run(`
            INSERT INTO companies (name, domain, contact_email, contact_phone, address, subscription_plan)
            VALUES ($1, $2, $3, $4, $5, $6)
        `, [companyName, companyDomain, contactEmail, contactPhone, companyAddress, subscriptionPlan]);
        
        const companies = await query('SELECT * FROM companies WHERE id = $1', [result.id]);
        
        res.json({
            message: 'Company added successfully',
            company: companies[0]
        });
    } catch (error) {
        console.error('Add company error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Add new event
app.post('/api/admin/events', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        const { eventCompany, eventName, eventLocation, startDate, endDate, eventDescription } = req.body;
        
        const result = await run(`
            INSERT INTO events (company_id, name, location, start_date, end_date, description)
            VALUES ($1, $2, $3, $4, $5, $6)
        `, [eventCompany, eventName, eventLocation, startDate, endDate, eventDescription]);
        
        const events = await query('SELECT * FROM events WHERE id = $1', [result.id]);
        
        res.json({
            message: 'Event created successfully',
            event: events[0]
        });
    } catch (error) {
        console.error('Add event error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Add new user
app.post('/api/admin/users', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        const { userCompany, userFirstName, userLastName, userEmail, userRole, userPassword } = req.body;
        
        // Hash password
        const passwordHash = await bcrypt.hash(userPassword, 10);
        
        const result = await run(`
            INSERT INTO users (company_id, first_name, last_name, email, password_hash, role)
            VALUES ($1, $2, $3, $4, $5, $6)
        `, [userCompany, userFirstName, userLastName, userEmail, passwordHash, userRole]);
        
        const users = await query('SELECT id, first_name, last_name, email, role, company_id FROM users WHERE id = $1', [result.id]);
        
        res.json({
            message: 'User added successfully',
            user: users[0]
        });
    } catch (error) {
        console.error('Add user error:', error);
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
