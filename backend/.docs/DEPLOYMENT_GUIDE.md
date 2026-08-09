# 🚀 FoodMonk Backend - Production Deployment Guide

This guide covers deploying your FoodMonk backend to production environments.

## 📋 Pre-Deployment Checklist

### 🔒 Security
- [ ] Changed JWT_SECRET to a strong random string
- [ ] Changed MASTER_PASSWORD to a secure password
- [ ] Updated CORS origins to specific domains
- [ ] Enabled HTTPS/SSL certificates
- [ ] Set NODE_ENV=production
- [ ] Removed console.log statements (or use proper logging)
- [ ] Configured rate limiting appropriately
- [ ] Reviewed all environment variables

### 🗄️ Database
- [ ] Set up production MongoDB (Atlas, etc.)
- [ ] Configured database backups
- [ ] Created database indexes
- [ ] Set up monitoring
- [ ] Configured connection pooling
- [ ] Tested connection from production server

### 💳 Payment
- [ ] Obtained live SSLCommerz credentials
- [ ] Set SSLCOMMERZ_IS_LIVE=true
- [ ] Tested with real payment
- [ ] Configured webhooks/callbacks
- [ ] Verified SSL certificates for callbacks

### 📁 Files
- [ ] Configured cloud storage (AWS S3, etc.)
- [ ] Set up CDN for static files
- [ ] Planned backup strategy for uploads
- [ ] Set appropriate file permissions

---

## 1️⃣ Deploying to VPS (Ubuntu/Debian)

### Step 1: Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install MongoDB
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list
sudo apt update
sudo apt install -y mongodb-org

# Start MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod

# Install PM2
sudo npm install -g pm2

# Install Nginx
sudo apt install -y nginx
```

### Step 2: Deploy Application

```bash
# Clone or upload your code
cd /var/www
sudo git clone <your-repo-url> foodmonk-backend
cd foodmonk-backend

# Install dependencies
npm install --production

# Create .env file
sudo nano .env
# Add your production environment variables

# Create uploads directory
mkdir -p uploads
sudo chown -R $USER:$USER uploads
```

### Step 3: Configure PM2

```bash
# Create PM2 ecosystem file
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'foodmonk-backend',
    script: './src/server.js',
    instances: 2,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production'
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true
  }]
};
EOF

# Create logs directory
mkdir -p logs

# Start with PM2
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 to start on system boot
pm2 startup
# Run the command that PM2 outputs

# Check status
pm2 status
pm2 logs
```

### Step 4: Configure Nginx

```bash
# Create Nginx configuration
sudo nano /etc/nginx/sites-available/foodmonk

# Add this configuration:
```

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL certificates (use Certbot/Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Logs
    access_log /var/log/nginx/foodmonk.access.log;
    error_log /var/log/nginx/foodmonk.error.log;

    # Max upload size
    client_max_body_size 10M;

    # Static files (uploads)
    location /uploads/ {
        alias /var/www/foodmonk-backend/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # API
    location / {
        proxy_pass http://localhost:7878;
        proxy_http_version 1.1;
        
        # Headers
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # Disable buffering for Socket.io
        proxy_buffering off;
        
        proxy_cache_bypass $http_upgrade;
    }

    # Socket.io
    location /socket.io/ {
        proxy_pass http://localhost:7878;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/foodmonk /etc/nginx/sites-enabled/

# Test Nginx configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

### Step 5: Setup SSL with Let's Encrypt

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Auto-renewal is configured automatically
# Test renewal
sudo certbot renew --dry-run
```

### Step 6: Setup Firewall

```bash
# Configure UFW
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

---

## 2️⃣ Deploying to Heroku

### Step 1: Prepare Application

```bash
# Add Procfile
echo "web: node src/server.js" > Procfile

# Ensure engines specified in package.json
```

```json
{
  "engines": {
    "node": "18.x",
    "npm": "9.x"
  }
}
```

### Step 2: Deploy

```bash
# Login to Heroku
heroku login

# Create app
heroku create foodmonk-backend

# Add MongoDB addon
heroku addons:create mongolab:sandbox

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set JWT_SECRET=your_secret
heroku config:set MASTER_PASSWORD=your_password
heroku config:set BASE_URL=https://foodmonk-backend.herokuapp.com
# ... add all other env vars

# Deploy
git push heroku main

# Check logs
heroku logs --tail
```

---

## 3️⃣ Deploying to AWS (EC2)

### Similar to VPS deployment, but with AWS-specific steps:

```bash
# 1. Launch EC2 instance (Ubuntu 20.04 LTS)
# 2. Configure Security Groups (ports 22, 80, 443)
# 3. Connect via SSH
# 4. Follow VPS deployment steps
# 5. Use AWS RDS for MongoDB or MongoDB Atlas
# 6. Use AWS S3 for file uploads
# 7. Use AWS CloudFront for CDN
```

---

## 4️⃣ Deploying to DigitalOcean

### Using DigitalOcean App Platform:

```bash
# 1. Connect GitHub repository
# 2. Configure build command: npm install
# 3. Configure run command: npm start
# 4. Add environment variables in dashboard
# 5. Add MongoDB database (managed)
# 6. Deploy
```

---

## 🗄️ Database Migration

### MongoDB Atlas Setup

```bash
# 1. Create account at mongodb.com/cloud/atlas
# 2. Create cluster
# 3. Create database user
# 4. Whitelist IP addresses
# 5. Get connection string
# 6. Update MONGODB_URI in .env
```

Connection string format:
```
mongodb+srv://username:password@cluster.mongodb.net/foodmonk?retryWrites=true&w=majority
```

---

## 📁 File Storage Setup

### AWS S3 Configuration

```bash
# Install AWS SDK
npm install aws-sdk
```

Update `fileUpload.js`:

```javascript
import AWS from 'aws-sdk';
import multer from 'multer';
import multerS3 from 'multer-s3';

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: process.env.AWS_BUCKET_NAME,
    acl: 'public-read',
    metadata: (req, file, cb) => {
      cb(null, { fieldName: file.fieldname });
    },
    key: (req, file, cb) => {
      cb(null, `${Date.now()}-${file.originalname}`);
    }
  })
});
```

---

## 📊 Monitoring Setup

### PM2 Monitoring

```bash
# Link to PM2 Plus (monitoring service)
pm2 link <secret> <public>

# Or use pm2 web dashboard
pm2 web
```

### Server Monitoring

```bash
# Install monitoring tools
npm install @sentry/node

# Add to server.js
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV
});
```

---

## 🔄 CI/CD Pipeline

### GitHub Actions Example

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Production

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v2
    
    - name: Setup Node.js
      uses: actions/setup-node@v2
      with:
        node-version: '18'
    
    - name: Install dependencies
      run: npm install
    
    - name: Run tests
      run: npm test
    
    - name: Deploy to server
      uses: appleboy/ssh-action@master
      with:
        host: ${{ secrets.HOST }}
        username: ${{ secrets.USERNAME }}
        key: ${{ secrets.SSH_KEY }}
        script: |
          cd /var/www/foodmonk-backend
          git pull origin main
          npm install --production
          pm2 restart foodmonk-backend
```

---

## 🔍 Health Checks

### Setup Health Check Monitoring

```bash
# Use services like:
# - UptimeRobot (free)
# - Pingdom
# - StatusCake

# Monitor endpoint: https://yourdomain.com/health
```

---

## 📝 Production .env Example

```env
# Server
NODE_ENV=production
PORT=7878
BASE_URL=https://api.yourdomain.com

# Database (MongoDB Atlas)
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/foodmonk

# Security (CHANGE THESE!)
JWT_SECRET=your_super_secret_production_jwt_key_min_32_chars
JWT_EXPIRES_IN=7d
MASTER_PASSWORD=YourVerySecureMasterPassword123!@#

# SSLCommerz (Live)
SSLCOMMERZ_STORE_ID=your_live_store_id
SSLCOMMERZ_STORE_PASSWORD=your_live_password
SSLCOMMERZ_IS_LIVE=true

# File Upload (S3)
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
AWS_BUCKET_NAME=foodmonk-uploads

# Monitoring
SENTRY_DSN=your_sentry_dsn

# Rate Limiting (stricter for production)
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=50
```

---

## 🔒 Security Hardening

```bash
# 1. Enable fail2ban
sudo apt install fail2ban
sudo systemctl enable fail2ban

# 2. Disable root login
sudo nano /etc/ssh/sshd_config
# Set: PermitRootLogin no

# 3. Install and configure ModSecurity

# 4. Regular security updates
sudo apt update && sudo apt upgrade
```

---

## 📊 Backup Strategy

### Database Backup

```bash
# Create backup script
cat > backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
mongodump --uri="$MONGODB_URI" --out="/backups/mongodb-$DATE"
# Upload to S3 or similar
aws s3 sync /backups s3://your-backup-bucket/mongodb/
# Keep only last 30 days
find /backups -type d -mtime +30 -exec rm -rf {} +
EOF

# Make executable
chmod +x backup.sh

# Add to crontab (daily at 2 AM)
crontab -e
# Add: 0 2 * * * /path/to/backup.sh
```

---

## 🎯 Performance Optimization

### Enable Gzip Compression in Nginx

```nginx
# Add to nginx.conf
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss;
```

### Enable HTTP/2

Already enabled in the Nginx config above (`http2`).

### Use CDN for Static Assets

Upload static assets to CloudFare, Cloudfront, or similar.

---

## 📱 Domain & DNS Setup

```
A Record: @ → Your_Server_IP
A Record: www → Your_Server_IP

# For API subdomain
A Record: api → Your_Server_IP
```

---

## ✅ Post-Deployment Verification

```bash
# 1. Check server status
pm2 status

# 2. Check logs
pm2 logs foodmonk-backend --lines 100

# 3. Test health endpoint
curl https://yourdomain.com/health

# 4. Test API
curl https://yourdomain.com/api-docs

# 5. Test Socket.io
# Use Socket.io client to connect

# 6. Monitor for 24 hours
pm2 monit
```

---

## 🆘 Troubleshooting

### Application won't start
```bash
pm2 logs foodmonk-backend
# Check for errors in logs
```

### Database connection issues
```bash
# Test connection
mongosh "your-connection-string"
```

### Nginx errors
```bash
sudo nginx -t
sudo tail -f /var/log/nginx/error.log
```

### SSL issues
```bash
sudo certbot renew --dry-run
```

---

## 🔄 Update/Rollback Procedures

### Update Application

```bash
cd /var/www/foodmonk-backend
git pull origin main
npm install --production
pm2 restart foodmonk-backend
```

### Rollback

```bash
git log --oneline  # Find commit to rollback to
git checkout <commit-hash>
npm install --production
pm2 restart foodmonk-backend
```

---

## 📈 Scaling Strategies

### Horizontal Scaling
- Use load balancer (Nginx, HAProxy)
- Run multiple PM2 instances
- Use Redis for session storage
- Deploy to multiple servers

### Vertical Scaling
- Increase server resources
- Optimize database queries
- Add indexes
- Use caching (Redis)

---

**Your application is now production-ready! 🎉**

Remember to:
- Monitor logs regularly
- Keep security updates current
- Backup database daily
- Test before deploying
- Have a rollback plan
