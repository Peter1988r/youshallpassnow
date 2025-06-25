const { pool } = require('./database/schema');

async function migrateDatabase() {
    const client = await pool.connect();
    try {
        console.log('Starting database migration...');
        
        // Add description column to existing roles table if it doesn't exist
        await client.query(`
            DO $$ BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='roles' AND column_name='description') THEN
                    ALTER TABLE roles ADD COLUMN description TEXT DEFAULT 'No description available';
                    RAISE NOTICE 'Added description column to roles table';
                ELSE
                    RAISE NOTICE 'Description column already exists in roles table';
                END IF;
            END $$;
        `);
        
        // Update existing roles with descriptions
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
            await client.query(`
                INSERT INTO roles (name, description)
                VALUES ($1, $2)
                ON CONFLICT (name) DO UPDATE SET description = $2
            `, [role.name, role.description]);
        }
        
        console.log('Database migration completed successfully!');
        
    } catch (error) {
        console.error('Migration error:', error);
        throw error;
    } finally {
        client.release();
    }
}

// Run migration if this file is executed directly
if (require.main === module) {
    migrateDatabase()
        .then(() => {
            console.log('Migration completed');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Migration failed:', error);
            process.exit(1);
        });
}

module.exports = { migrateDatabase }; 