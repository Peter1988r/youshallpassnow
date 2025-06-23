# 🚀 YouShallPass Deployment Guide

## Deploying to youshallpass.me

This guide will help you deploy your YouShallPass application to your new domain.

## 📋 Pre-Deployment Checklist

### 1. Environment Variables
Create a `.env` file in your project root:

```env
# Server Configuration
PORT=3000
NODE_ENV=production

# JWT Secret (CHANGE THIS!)
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Security
CORS_ORIGIN=https://youshallpass.me
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Database
DATABASE_URL=./database/weaccredit.db
```

### 2. Domain Configuration
- Point your domain `youshallpass.me` to your hosting provider
- Set up SSL certificate (HTTPS)
- Configure DNS records

## 🎯 Recommended Hosting Options

### Option 1: Railway (Recommended for MVP)

**Steps:**
1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub
3. Create new project
4. Connect your GitHub repository
5. Add environment variables
6. Deploy

**Pros:** Easy setup, good free tier, supports databases
**Cons:** Limited free tier

### Option 2: Vercel

**Steps:**
1. Go to [vercel.com](https://vercel.com)
2. Sign up with GitHub
3. Import your repository
4. Configure build settings
5. Deploy

**Pros:** Free tier, automatic deployments
**Cons:** Limited server-side features

### Option 3: Heroku

**Steps:**
1. Go to [heroku.com](https://heroku.com)
2. Create account
3. Install Heroku CLI
4. Create new app
5. Deploy with Git

**Pros:** Reliable, good documentation
**Cons:** No free tier

### Option 4: DigitalOcean App Platform

**Steps:**
1. Go to [digitalocean.com](https://digitalocean.com)
2. Create account
3. Create new app
4. Connect repository
5. Configure environment

**Pros:** Scalable, good performance
**Cons:** More complex setup

## 🔧 Deployment Steps

### Step 1: Prepare Your Code

1. **Update package.json** (already done)
2. **Create .env file** with production values
3. **Test locally** with production settings

### Step 2: Choose Hosting Platform

For **Railway** (recommended):

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Initialize project
railway init

# Add environment variables
railway variables set NODE_ENV=production
railway variables set JWT_SECRET=your-secret-key
railway variables set CORS_ORIGIN=https://youshallpass.me

# Deploy
railway up
```

### Step 3: Configure Domain

1. **Get your app URL** from your hosting provider
2. **Configure DNS** at your domain registrar:
   ```
   Type: CNAME
   Name: @
   Value: your-app-url.railway.app
   ```
3. **Set up custom domain** in your hosting platform
4. **Configure SSL certificate**

### Step 4: Database Setup

**For Railway:**
- Railway provides PostgreSQL
- Update database connection in production

**For other platforms:**
- Use SQLite (included) or external database
- Consider migrating to PostgreSQL for production

## 🔒 Security Checklist

- [ ] Change JWT_SECRET to a strong random string
- [ ] Set NODE_ENV=production
- [ ] Configure CORS_ORIGIN to your domain
- [ ] Enable HTTPS/SSL
- [ ] Set up rate limiting
- [ ] Configure proper logging
- [ ] Set up monitoring

## 📊 Post-Deployment

### 1. Test Your Application
- [ ] Test login functionality
- [ ] Test Super Admin dashboard
- [ ] Test company admin features
- [ ] Test PDF generation
- [ ] Test approval workflow

### 2. Monitor Performance
- [ ] Set up error monitoring
- [ ] Monitor response times
- [ ] Check database performance
- [ ] Monitor file uploads

### 3. Backup Strategy
- [ ] Set up database backups
- [ ] Backup uploaded files
- [ ] Document recovery procedures

## 🚨 Troubleshooting

### Common Issues:

1. **Port Issues**
   ```javascript
   // In index.js, ensure you're using process.env.PORT
   const port = process.env.PORT || 3000;
   ```

2. **Database Path Issues**
   ```javascript
   // Use absolute paths for database
   const dbPath = path.join(__dirname, 'database', 'weaccredit.db');
   ```

3. **File Upload Issues**
   ```javascript
   // Ensure upload directory exists
   const uploadDir = path.join(__dirname, 'public', 'uploads');
   if (!fs.existsSync(uploadDir)) {
     fs.mkdirSync(uploadDir, { recursive: true });
   }
   ```

4. **CORS Issues**
   ```javascript
   // Configure CORS for your domain
   app.use(cors({
     origin: process.env.CORS_ORIGIN || 'https://youshallpass.me'
   }));
   ```

## 📞 Support

If you encounter issues:
1. Check hosting provider documentation
2. Review error logs
3. Test locally with production settings
4. Contact hosting provider support

## 🎉 Success!

Once deployed, your YouShallPass application will be available at:
**https://youshallpass.me**

**Super Admin Login:** admin@youshallpass.com / admin123
**Company Admin Login:** company@demo.youshallpass.com / company123 