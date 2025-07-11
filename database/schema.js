const { Pool } = require('pg');

// Database connection configuration
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres.lqcsuivqcdamkaskbwhz:zT6lyvDJHioVhuYa@aws-0-eu-north-1.pooler.supabase.com:6543/postgres',
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

        // Add custom badge template columns to events table
        await client.query(`
            DO $$ BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='custom_badge_template_path') THEN
                    ALTER TABLE events ADD COLUMN custom_badge_template_path TEXT;
                END IF;
            END $$;
        `);

        await client.query(`
            DO $$ BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='custom_badge_field_mapping') THEN
                    ALTER TABLE events ADD COLUMN custom_badge_field_mapping JSONB;
                END IF;
            END $$;
        `);

        await client.query(`
            DO $$ BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='use_custom_badge') THEN
                    ALTER TABLE events ADD COLUMN use_custom_badge BOOLEAN DEFAULT FALSE;
                END IF;
            END $$;
        `);

        await client.query(`
            DO $$ BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='badge_template_name') THEN
                    ALTER TABLE events ADD COLUMN badge_template_name TEXT;
                END IF;
            END $$;
        `);

        // New simplified badge template columns
        await client.query(`
            DO $$ BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='badge_template_image_path') THEN
                    ALTER TABLE events ADD COLUMN badge_template_image_path TEXT;
                END IF;
            END $$;
        `);

        await client.query(`
            DO $$ BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='badge_field_layout') THEN
                    ALTER TABLE events ADD COLUMN badge_field_layout JSONB;
                END IF;
            END $$;
        `);

        // Add access zones column to events table
        await client.query(`
            DO $$ BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='access_zones') THEN
                    ALTER TABLE events ADD COLUMN access_zones JSONB DEFAULT '[]'::jsonb;
                END IF;
            END $$;
        `);

        // Add event photo column to events table
        await client.query(`
            DO $$ BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='event_photo_path') THEN
                    ALTER TABLE events ADD COLUMN event_photo_path TEXT;
                END IF;
            END $$;
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

        // QR scan logs table for audit trail
        await client.query(`
            CREATE TABLE IF NOT EXISTS qr_scan_logs (
                id SERIAL PRIMARY KEY,
                crew_member_id INTEGER REFERENCES crew_members(id),
                event_id INTEGER REFERENCES events(id),
                scanned_data TEXT NOT NULL,
                validation_result TEXT NOT NULL,
                scanner_ip TEXT,
                scanner_user_agent TEXT,
                scan_location TEXT,
                scanned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Add roles table for role library
        await client.query(`
            CREATE TABLE IF NOT EXISTS roles (
                id SERIAL PRIMARY KEY,
                name TEXT UNIQUE NOT NULL,
                description TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Add description column to existing roles table if it doesn't exist
        await client.query(`
            DO $$ BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='roles' AND column_name='description') THEN
                    ALTER TABLE roles ADD COLUMN description TEXT DEFAULT 'No description available';
                END IF;
            END $$;
        `);

        // Ensure the roles table has a unique constraint on name
        await client.query(`
            DO $$ BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'roles_name_key') THEN
                    ALTER TABLE roles ADD CONSTRAINT roles_name_key UNIQUE (name);
                END IF;
            END $$;
        `);

        // Insert default roles if they don't exist
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
            try {
                await client.query(`
                    INSERT INTO roles (name, description)
                    VALUES ($1, $2)
                    ON CONFLICT (name) DO UPDATE SET description = $2
                `, [role.name, role.description]);
            } catch (roleError) {
                // If there's still an issue, try a simple check-and-insert
                const existing = await client.query('SELECT id FROM roles WHERE name = $1', [role.name]);
                if (existing.rows.length === 0) {
                    await client.query(`
                        INSERT INTO roles (name, description) VALUES ($1, $2)
                    `, [role.name, role.description]);
                }
            }
        }

        // Add event_companies junction table for many-to-many relationship
        await client.query(`
            CREATE TABLE IF NOT EXISTS event_companies (
                id SERIAL PRIMARY KEY,
                event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
                company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
                assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(event_id, company_id)
            )
        `);

        // Add company_roles junction table for role assignments
        await client.query(`
            CREATE TABLE IF NOT EXISTS company_roles (
                id SERIAL PRIMARY KEY,
                company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
                role_name TEXT NOT NULL,
                assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(company_id, role_name)
            )
        `);

        // Add access_level column to crew_members if not exists (for per-event assignment)
        await client.query(`
            DO $$ BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='crew_members' AND column_name='access_level') THEN
                    ALTER TABLE crew_members ADD COLUMN access_level TEXT DEFAULT 'RESTRICTED';
                END IF;
            END $$;
        `);

        // Add company_id column to crew_members table if not exists
        await client.query(`
            DO $$ BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='crew_members' AND column_name='company_id') THEN
                    ALTER TABLE crew_members ADD COLUMN company_id INTEGER REFERENCES companies(id);
                END IF;
            END $$;
        `);

        // Add access zones column to crew_members table (replaces simple access_level)
        await client.query(`
            DO $$ BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='crew_members' AND column_name='access_zones') THEN
                    ALTER TABLE crew_members ADD COLUMN access_zones JSONB DEFAULT '[]'::jsonb;
                END IF;
            END $$;
        `);

        // Add QR code columns to crew_members table
        await client.query(`
            DO $$ BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='crew_members' AND column_name='qr_code_data') THEN
                    ALTER TABLE crew_members ADD COLUMN qr_code_data TEXT;
                END IF;
            END $$;
        `);

        await client.query(`
            DO $$ BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='crew_members' AND column_name='qr_signature') THEN
                    ALTER TABLE crew_members ADD COLUMN qr_signature TEXT;
                END IF;
            END $$;
        `);

        await client.query(`
            DO $$ BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='crew_members' AND column_name='qr_generated_at') THEN
                    ALTER TABLE crew_members ADD COLUMN qr_generated_at TIMESTAMP;
                END IF;
            END $$;
        `);

        // Insert default super admin user
        const bcrypt = require('bcryptjs');
        const adminPassword = bcrypt.hashSync('admin123', 10);
        
        await client.query(`
            INSERT INTO users (email, password_hash, first_name, last_name, role, is_super_admin)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (email) DO NOTHING
        `, ['admin@youshallpass.com', adminPassword, 'Super', 'Admin', 'super_admin', true]);

        // Insert sample company and get its ID
        const companyResult = await client.query(`
            INSERT INTO companies (name, domain, contact_email, contact_phone, address)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (domain) DO UPDATE SET name = EXCLUDED.name
            RETURNING id
        `, ['YouShallPass Demo Company', 'demo.youshallpass.com', 'contact@demo.youshallpass.com', '+1-555-0123', '123 Demo Street, Demo City, DC 12345']);

        let companyId = companyResult.rows[0]?.id;
        
        // If no ID returned (conflict case), get the existing company ID
        if (!companyId) {
            const existingCompany = await client.query('SELECT id FROM companies WHERE domain = $1', ['demo.youshallpass.com']);
            companyId = existingCompany.rows[0]?.id;
        }

        // Insert sample company admin with the correct company ID
        if (companyId) {
            const companyAdminPassword = bcrypt.hashSync('company123', 10);
            await client.query(`
                INSERT INTO users (company_id, email, password_hash, first_name, last_name, role)
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (email) DO NOTHING
            `, [companyId, 'company@demo.youshallpass.com', companyAdminPassword, 'Company', 'Admin', 'admin']);
        }

        // Insert field admin user for QR code validation
        const fieldAdminPassword = bcrypt.hashSync('admin123', 10);
        await client.query(`
            INSERT INTO users (email, password_hash, first_name, last_name, role, is_super_admin)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (email) DO NOTHING
        `, ['fieldadmin@youshallpass.me', fieldAdminPassword, 'Field', 'Admin', 'field_admin', false]);

        // Insert sample events only if they don't exist and we have a valid company ID
        if (companyId) {
            const existingEvents = await client.query('SELECT COUNT(*) as count FROM events');
            if (existingEvents.rows[0].count === 0) {
                console.log('Creating sample events...');
                
                await client.query(`
                    INSERT INTO events (company_id, name, location, start_date, end_date, description)
                    VALUES ($1, $2, $3, $4, $5, $6)
                `, [companyId, 'Formula E World Championship', 'São Paulo, Brazil', '2024-03-15', '2024-03-16', 'Experience the future of racing at the São Paulo E-Prix']);

                await client.query(`
                    INSERT INTO events (company_id, name, location, start_date, end_date, description)
                    VALUES ($1, $2, $3, $4, $5, $6)
                `, [companyId, 'Extreme E Desert X Prix', 'Saudi Arabia', '2024-04-03', '2024-04-04', 'Watch electric SUVs battle it out in the desert']);

                await client.query(`
                    INSERT INTO events (company_id, name, location, start_date, end_date, description)
                    VALUES ($1, $2, $3, $4, $5, $6)
                `, [companyId, 'E1 Series Championship', 'Venice, Italy', '2024-05-20', '2024-05-21', 'The world\'s first electric powerboat racing series']);
                
                console.log('Sample events created successfully');
            } else {
                console.log('Events already exist, skipping sample event creation');
            }
        }

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