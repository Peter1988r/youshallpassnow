const { Pool } = require('pg');

// Database connection configuration
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:zT6lyvDJHioVhuYa@db.lqcsuivqcdamkaskbwhz.supabase.co:5432/postgres',
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// Initialize database tables
const initDatabase = async () => {
    try {
        const client = await pool.connect();
        
        // Companies table
        await client.query(`
            CREATE TABLE IF NOT EXISTS companies (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                domain TEXT UNIQUE,
                contact_email TEXT,
                contact_phone TEXT,
                address TEXT,
                logo_path TEXT,
                status TEXT DEFAULT 'active',
                subscription_plan TEXT DEFAULT 'basic',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Users table
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                company_id INTEGER REFERENCES companies(id),
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                first_name TEXT NOT NULL,
                last_name TEXT NOT NULL,
                role TEXT DEFAULT 'user',
                is_super_admin BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Events table
        await client.query(`
            CREATE TABLE IF NOT EXISTS events (
                id SERIAL PRIMARY KEY,
                company_id INTEGER NOT NULL REFERENCES companies(id),
                name TEXT NOT NULL,
                location TEXT NOT NULL,
                start_date DATE NOT NULL,
                end_date DATE NOT NULL,
                description TEXT,
                status TEXT DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Crew members table
        await client.query(`
            CREATE TABLE IF NOT EXISTS crew_members (
                id SERIAL PRIMARY KEY,
                event_id INTEGER NOT NULL REFERENCES events(id),
                first_name TEXT NOT NULL,
                last_name TEXT NOT NULL,
                email TEXT NOT NULL,
                role TEXT NOT NULL,
                access_level TEXT NOT NULL,
                badge_number TEXT UNIQUE,
                photo_path TEXT,
                status TEXT DEFAULT 'pending_approval',
                approved_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Access logs table
        await client.query(`
            CREATE TABLE IF NOT EXISTS access_logs (
                id SERIAL PRIMARY KEY,
                crew_member_id INTEGER NOT NULL REFERENCES crew_members(id),
                event_id INTEGER NOT NULL REFERENCES events(id),
                access_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                location TEXT,
                action TEXT DEFAULT 'entry'
            )
        `);

        // Insert default super admin user
        const bcrypt = require('bcryptjs');
        const adminPassword = bcrypt.hashSync('admin123', 10);
        
        await client.query(`
            INSERT INTO users (email, password_hash, first_name, last_name, role, is_super_admin)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (email) DO NOTHING
        `, ['admin@youshallpass.com', adminPassword, 'Super', 'Admin', 'super_admin', true]);

        // Insert sample company
        await client.query(`
            INSERT INTO companies (name, domain, contact_email, contact_phone, address)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (domain) DO NOTHING
        `, ['YouShallPass Demo Company', 'demo.youshallpass.com', 'contact@demo.youshallpass.com', '+1-555-0123', '123 Demo Street, Demo City, DC 12345']);

        // Insert sample company admin
        const companyAdminPassword = bcrypt.hashSync('company123', 10);
        await client.query(`
            INSERT INTO users (company_id, email, password_hash, first_name, last_name, role)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (email) DO NOTHING
        `, [1, 'company@demo.youshallpass.com', companyAdminPassword, 'Company', 'Admin', 'admin']);

        // Insert sample events
        await client.query(`
            INSERT INTO events (company_id, name, location, start_date, end_date, description)
            VALUES 
            ($1, $2, $3, $4, $5, $6),
            ($1, $7, $8, $9, $10, $11),
            ($1, $12, $13, $14, $15, $16)
            ON CONFLICT DO NOTHING
        `, [
            1, 'Formula E World Championship', 'São Paulo, Brazil', '2024-03-15', '2024-03-16', 'Experience the future of racing at the São Paulo E-Prix',
            1, 'Extreme E Desert X Prix', 'Saudi Arabia', '2024-04-03', '2024-04-04', 'Watch electric SUVs battle it out in the desert',
            1, 'E1 Series Championship', 'Venice, Italy', '2024-05-20', '2024-05-21', 'The world\'s first electric powerboat racing series'
        ]);

        client.release();
        console.log('✅ Database initialized successfully');
    } catch (error) {
        console.error('Database initialization error:', error);
        throw error;
    }
};

// Helper function to run queries
const query = async (sql, params = []) => {
    try {
        const client = await pool.connect();
        const result = await client.query(sql, params);
        client.release();
        return result.rows;
    } catch (error) {
        console.error('Query error:', error);
        throw error;
    }
};

// Helper function to run single queries
const run = async (sql, params = []) => {
    try {
        const client = await pool.connect();
        const result = await client.query(sql, params);
        client.release();
        return { id: result.rows[0]?.id, changes: result.rowCount };
    } catch (error) {
        console.error('Run error:', error);
        throw error;
    }
};

module.exports = {
    pool,
    initDatabase,
    query,
    run
}; 