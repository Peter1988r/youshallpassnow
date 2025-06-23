const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database file path
const dbPath = path.join(__dirname, 'weaccredit.db');

// Create database connection
const db = new sqlite3.Database(dbPath);

// Initialize database tables
const initDatabase = () => {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            // Companies table (NEW - for multi-company support)
            db.run(`
                CREATE TABLE IF NOT EXISTS companies (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    domain TEXT UNIQUE,
                    contact_email TEXT,
                    contact_phone TEXT,
                    address TEXT,
                    logo_path TEXT,
                    status TEXT DEFAULT 'active',
                    subscription_plan TEXT DEFAULT 'basic',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Users table (updated to include company_id)
            db.run(`
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    company_id INTEGER,
                    email TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    first_name TEXT NOT NULL,
                    last_name TEXT NOT NULL,
                    role TEXT DEFAULT 'user',
                    is_super_admin BOOLEAN DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (company_id) REFERENCES companies (id)
                )
            `);

            // Events table (updated to include company_id)
            db.run(`
                CREATE TABLE IF NOT EXISTS events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    company_id INTEGER NOT NULL,
                    name TEXT NOT NULL,
                    location TEXT NOT NULL,
                    start_date DATE NOT NULL,
                    end_date DATE NOT NULL,
                    description TEXT,
                    status TEXT DEFAULT 'active',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (company_id) REFERENCES companies (id)
                )
            `);

            // Crew members table (no changes needed - already linked to events)
            db.run(`
                CREATE TABLE IF NOT EXISTS crew_members (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    event_id INTEGER NOT NULL,
                    first_name TEXT NOT NULL,
                    last_name TEXT NOT NULL,
                    email TEXT NOT NULL,
                    role TEXT NOT NULL,
                    access_level TEXT NOT NULL,
                    badge_number TEXT UNIQUE,
                    photo_path TEXT,
                    status TEXT DEFAULT 'pending_approval',
                    approved_at DATETIME,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (event_id) REFERENCES events (id)
                )
            `);

            // Access logs table (no changes needed)
            db.run(`
                CREATE TABLE IF NOT EXISTS access_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    crew_member_id INTEGER NOT NULL,
                    event_id INTEGER NOT NULL,
                    access_time DATETIME DEFAULT CURRENT_TIMESTAMP,
                    location TEXT,
                    action TEXT DEFAULT 'entry',
                    FOREIGN KEY (crew_member_id) REFERENCES crew_members (id),
                    FOREIGN KEY (event_id) REFERENCES events (id)
                )
            `);

            // Insert default super admin user
            const bcrypt = require('bcryptjs');
            const adminPassword = bcrypt.hashSync('admin123', 10);
            
            db.run(`
                INSERT OR IGNORE INTO users (email, password_hash, first_name, last_name, role, is_super_admin)
                VALUES (?, ?, ?, ?, ?, ?)
            `, ['admin@youshallpass.com', adminPassword, 'Super', 'Admin', 'super_admin', 1]);

            // Insert sample company
            db.run(`
                INSERT OR IGNORE INTO companies (name, domain, contact_email, contact_phone, address)
                VALUES (?, ?, ?, ?, ?)
            `, ['YouShallPass Demo Company', 'demo.youshallpass.com', 'contact@demo.youshallpass.com', '+1-555-0123', '123 Demo Street, Demo City, DC 12345']);

            // Insert sample company admin
            const companyAdminPassword = bcrypt.hashSync('company123', 10);
            db.run(`
                INSERT OR IGNORE INTO users (company_id, email, password_hash, first_name, last_name, role)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [1, 'company@demo.youshallpass.com', companyAdminPassword, 'Company', 'Admin', 'admin']);

            // Insert sample events (linked to company)
            db.run(`
                INSERT OR IGNORE INTO events (company_id, name, location, start_date, end_date, description)
                VALUES 
                (1, 'Formula E World Championship', 'São Paulo, Brazil', '2024-03-15', '2024-03-16', 'Experience the future of racing at the São Paulo E-Prix'),
                (1, 'Extreme E Desert X Prix', 'Saudi Arabia', '2024-04-03', '2024-04-04', 'Watch electric SUVs battle it out in the desert'),
                (1, 'E1 Series Championship', 'Venice, Italy', '2024-05-20', '2024-05-21', 'The world''s first electric powerboat racing series')
            `);

            console.log('✅ Database initialized successfully');
            resolve();
        });
    });
};

// Helper function to run queries
const query = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
};

// Helper function to run single queries
const run = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) {
                reject(err);
            } else {
                resolve({ id: this.lastID, changes: this.changes });
            }
        });
    });
};

module.exports = {
    db,
    initDatabase,
    query,
    run
}; 