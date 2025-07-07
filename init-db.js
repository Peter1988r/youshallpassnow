const { initDatabase } = require('./database/schema');

async function initializeDatabase() {
    console.log('🔄 Initializing database...');
    
    try {
        await initDatabase();
        console.log('✅ Database initialized successfully');
    } catch (error) {
        console.error('❌ Database initialization failed:', error);
        throw error;
    }
}

// Run if called directly
if (require.main === module) {
    initializeDatabase()
        .then(() => {
            console.log('✅ Database initialization completed');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Database initialization failed:', error);
            process.exit(1);
        });
}

module.exports = { initializeDatabase }; 