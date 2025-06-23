# ⚡ Quick Deploy to youshallpass.me

## 🚀 Fastest Way to Deploy (Railway)

### Step 1: Prepare Your Code
```bash
# Run the deployment script
./deploy.sh
```

### Step 2: Push to GitHub
```bash
# Initialize git if not already done
git init
git add .
git commit -m "Initial commit for youshallpass.me"

# Create GitHub repository and push
# (Do this on GitHub.com first)
git remote add origin https://github.com/yourusername/youshallpass.git
git push -u origin main
```

### Step 3: Deploy to Railway
1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub
3. Click "New Project"
4. Select "Deploy from GitHub repo"
5. Choose your `youshallpass` repository
6. Click "Deploy Now"

### Step 4: Configure Environment Variables
In Railway dashboard:
```
NODE_ENV=production
JWT_SECRET=your-super-secret-key-here
CORS_ORIGIN=https://youshallpass.me
PORT=3000
```

### Step 5: Connect Your Domain
1. In Railway, go to your project settings
2. Click "Custom Domains"
3. Add `youshallpass.me`
4. Configure DNS at your domain registrar:
   ```
   Type: CNAME
   Name: @
   Value: your-app.railway.app
   ```

## 🎯 Alternative: Vercel (Even Faster)

### Step 1: Deploy to Vercel
1. Go to [vercel.com](https://vercel.com)
2. Sign up with GitHub
3. Click "New Project"
4. Import your `youshallpass` repository
5. Click "Deploy"

### Step 2: Configure Domain
1. In Vercel dashboard, go to "Settings" → "Domains"
2. Add `youshallpass.me`
3. Follow Vercel's DNS instructions

## 🔑 Access Credentials

Once deployed, access your app at: **https://youshallpass.me**

**Super Admin:**
- Email: `admin@youshallpass.com`
- Password: `admin123`

**Company Admin:**
- Email: `company@demo.youshallpass.com`
- Password: `company123`

## 🚨 Important Security Notes

1. **Change the JWT_SECRET** in your hosting platform
2. **Update admin passwords** after first login
3. **Enable HTTPS** (automatic with Railway/Vercel)
4. **Monitor your app** for any issues

## 📞 Need Help?

- **Railway Docs:** https://docs.railway.app
- **Vercel Docs:** https://vercel.com/docs
- **Domain DNS Help:** Contact your domain registrar

## 🎉 Success!

Your YouShallPass application is now live at **https://youshallpass.me**! 