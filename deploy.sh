#!/bin/bash

# YouShallPass Deployment Script
echo "🚀 YouShallPass Deployment Script"
echo "=================================="

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Creating example..."
    cat > .env << EOF
# YouShallPass Production Configuration
PORT=3000
NODE_ENV=production
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
CORS_ORIGIN=https://youshallpass.me
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
DATABASE_URL=./database/weaccredit.db
EOF
    echo "✅ Created .env file. Please update with your actual values!"
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Check if database exists
if [ ! -f database/weaccredit.db ]; then
    echo "🗄️  Initializing database..."
    node -e "require('./database/schema').initDatabase().then(() => console.log('Database initialized'))"
fi

# Create necessary directories
echo "📁 Creating necessary directories..."
mkdir -p public/badges
mkdir -p public/uploads

# Set permissions
echo "🔐 Setting permissions..."
chmod 755 public/badges
chmod 755 public/uploads

# Test the application
echo "🧪 Testing application..."
node -e "
const { initDatabase } = require('./database/schema');
initDatabase().then(() => {
    console.log('✅ Database connection successful');
    process.exit(0);
}).catch(err => {
    console.error('❌ Database connection failed:', err);
    process.exit(1);
});
"

if [ $? -eq 0 ]; then
    echo "✅ Application is ready for deployment!"
    echo ""
    echo "📋 Next steps:"
    echo "1. Choose your hosting platform (Railway recommended)"
    echo "2. Push your code to GitHub"
    echo "3. Connect your repository to your hosting platform"
    echo "4. Set environment variables in your hosting platform"
    echo "5. Deploy!"
    echo ""
    echo "🌐 Your app will be available at: https://youshallpass.me"
    echo ""
    echo "📖 See DEPLOYMENT.md for detailed instructions"
else
    echo "❌ Application test failed. Please check the errors above."
    exit 1
fi 