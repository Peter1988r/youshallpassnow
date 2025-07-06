#!/usr/bin/env node

const { spawn } = require('child_process');
const config = require('./dev.config');

console.log('🚀 YouShallPass Development Environment');
console.log('=====================================');
console.log('');

// Display configuration
console.log('📋 Configuration:');
console.log(`   • Main Server: ${config.urls.main}`);
console.log(`   • Static Server: ${config.urls.static}`);
console.log(`   • Debug Console: ${config.urls.debug}`);
console.log(`   • Admin Panel: ${config.urls.admin}`);
console.log(`   • Dashboard: ${config.urls.dashboard}`);
console.log('');

// Display test credentials
console.log('🔐 Test Credentials:');
console.log(`   • Admin: ${config.testCredentials.admin.email} / ${config.testCredentials.admin.password}`);
console.log(`   • Company: ${config.testCredentials.company.email} / ${config.testCredentials.company.password}`);
console.log('');

// Display debug endpoints
console.log('🔍 Debug Endpoints:');
config.debugEndpoints.forEach(endpoint => {
    console.log(`   • ${config.urls.main}${endpoint}`);
});
console.log('');

// Display development tips
console.log('💡 Development Tips:');
console.log('   • Use the Debug Console for comprehensive testing');
console.log('   • Check browser dev tools for frontend issues');
console.log('   • Use VS Code debugger with the --inspect flag');
console.log('   • Check server logs for backend issues');
console.log('   • Test API endpoints directly in the debug console');
console.log('');

// Display available commands
console.log('🛠️  Available Commands:');
console.log('   • npm run dev        - Start main server with auto-reload');
console.log('   • npm run dev:static - Start static file server');
console.log('   • npm run dev:both   - Start both servers');
console.log('   • npm run dev:debug  - Start with Node.js debugger');
console.log('');

// Check if we should start servers
const args = process.argv.slice(2);
if (args.includes('--start-both')) {
    console.log('Starting both servers...');
    
    // Start main server
    const mainServer = spawn('npm', ['run', 'dev'], { stdio: 'inherit' });
    
    // Start static server after a short delay
    setTimeout(() => {
        const staticServer = spawn('npm', ['run', 'dev:static'], { stdio: 'inherit' });
        
        staticServer.on('error', (error) => {
            console.error('Static server error:', error);
        });
    }, 2000);
    
    mainServer.on('error', (error) => {
        console.error('Main server error:', error);
    });
    
    // Handle shutdown
    process.on('SIGINT', () => {
        console.log('\n🛑 Shutting down development servers...');
        mainServer.kill();
        process.exit(0);
    });
    
} else if (args.includes('--start-main')) {
    console.log('Starting main server...');
    const mainServer = spawn('npm', ['run', 'dev'], { stdio: 'inherit' });
    
    mainServer.on('error', (error) => {
        console.error('Main server error:', error);
    });
    
} else {
    console.log('✨ Ready to debug!');
    console.log('');
    console.log('To start servers:');
    console.log('   node dev-start.js --start-main   (main server only)');
    console.log('   node dev-start.js --start-both   (both servers)');
    console.log('   npm run dev:both                 (using concurrently)');
    console.log('');
    console.log('Quick Start: npm run dev:both');
} 