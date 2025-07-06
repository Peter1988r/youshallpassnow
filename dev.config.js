// Development Configuration for Local Debugging
module.exports = {
    // Server configuration
    servers: {
        main: {
            port: 3000,
            command: 'npm run dev',
            description: 'Main application server with API endpoints'
        },
        static: {
            port: 3001,
            command: 'npm run dev:static',
            description: 'Static file server for frontend testing'
        }
    },
    
    // Debug URLs
    urls: {
        main: 'http://localhost:3000',
        static: 'http://localhost:3001',
        debug: 'http://localhost:3000/debug.html',
        admin: 'http://localhost:3000/admin',
        dashboard: 'http://localhost:3000/dashboard'
    },
    
    // Environment variables for development
    env: {
        NODE_ENV: 'development',
        PORT: 3000,
        DEBUG: 'youshallpass:*',
        CORS_ORIGIN: 'http://localhost:3000'
    },
    
    // Test credentials
    testCredentials: {
        admin: {
            email: 'admin@youshallpass.com',
            password: 'admin123'
        },
        company: {
            email: 'company@demo.youshallpass.com',
            password: 'company123'
        }
    },
    
    // Common debug endpoints
    debugEndpoints: [
        '/health',
        '/debug-env',
        '/api/events',
        '/api/companies',
        '/api/auth/login',
        '/api/test-supabase-config'
    ],
    
    // Development tools
    tools: {
        browserSync: false, // Set to true if you want to use browser-sync
        hotReload: true,
        autoOpenBrowser: false,
        logLevel: 'debug'
    }
}; 