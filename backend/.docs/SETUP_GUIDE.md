# 🍽️ FoodMonk Restaurant Backend - Complete Setup Guide

## 📋 Table of Contents
1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Configuration](#configuration)
4. [Running the Application](#running-the-application)
5. [Testing](#testing)
6. [Project Structure](#project-structure)
7. [Features](#features)
8. [Troubleshooting](#troubleshooting)

## 🔧 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
- **MongoDB** (v6 or higher) - [Download](https://www.mongodb.com/try/download/community)
- **npm** (comes with Node.js) or **yarn**
- **Postman** (optional, for API testing) - [Download](https://www.postman.com/downloads/)

### Verify Installations

```bash
node --version    # Should show v18.x.x or higher
npm --version     # Should show 9.x.x or higher
mongod --version  # Should show v6.x.x or higher
```

## 📦 Installation

### Step 1: Install Dependencies

```bash
cd foodmonk-backend
npm install
```

This will install all required packages including:
- Express.js (Web framework)
- Mongoose (MongoDB ODM)
- JWT (Authentication)
- Socket.io (Real-time communication)
- Multer (File uploads)
- SSLCommerz (Payment gateway)
- And more...

### Step 2: Start MongoDB

**On macOS:**
```bash
brew services start mongodb-community
# Or manually:
mongod --dbpath /usr/local/var/mongodb
```

**On Windows:**
```bash
# MongoDB should start automatically as a service
# Or run manually:
"C:\Program Files\MongoDB\Server\6.0\bin\mongod.exe" --dbpath="C:\data\db"
```

**On Linux:**
```bash
sudo systemctl start mongod
# Or:
sudo service mongod start
```

**Verify MongoDB is Running:**
```bash
mongosh
# You should see MongoDB shell
# Type: exit
```

## ⚙️ Configuration

### Step 3: Environment Variables

The `.env` file is already created with default values. Review and update if needed:

```bash
# Open .env file
nano .env
# Or use your preferred editor
```

**Important Settings to Review:**

```env
# Server
PORT=7878                    # Change if port 7878 is busy

# Database
MONGODB_URI=mongodb://localhost:27017/foodmonk  # Update if using remote MongoDB

# Security
JWT_SECRET=foodmonk_secret_key_change_this_in_production_2024  # CHANGE IN PRODUCTION!
MASTER_PASSWORD=AdminMaster@123  # CHANGE THIS!

# Payment Gateway (SSLCommerz Sandbox)
SSLCOMMERZ_STORE_ID=testbox
SSLCOMMERZ_STORE_PASSWORD=qwerty
SSLCOMMERZ_IS_LIVE=false     # Keep false for testing
```

### Step 4: Seed Database (Optional but Recommended)

Populate the database with sample data:

```bash
npm run seed
```

This will create:
- ✅ 1 Owner account (username: admin, password: admin123)
- ✅ 1 Restaurant with details
- ✅ 8 Sample food items
- ✅ 5 Sample tables with unique URLs

**Output will show:**
```
✅ Database seeded successfully!

🔐 Login Credentials:
   Username: admin
   Password: admin123

🔑 Master Password: AdminMaster@123

📋 Sample Table URLs:
   T-01: http://localhost:7878/api/public/table/[unique-url]
   ...
```

## 🚀 Running the Application

### Development Mode (with auto-reload)

```bash
npm run dev
```

### Production Mode

```bash
npm start
```

**You should see:**
```
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║           🍽️  FoodMonk Restaurant Backend API 🍽️           ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝

✅ MongoDB Connected: localhost
🚀 Server running in development mode on port 7878
📚 API Documentation: http://localhost:7878/api-docs
🏥 Health Check: http://localhost:7878/health
⚡ Socket.io: Connected and ready
```

### Verify Server is Running

Open your browser and visit:
- **Health Check**: http://localhost:7878/health
- **API Documentation**: http://localhost:7878/api-docs

## 🧪 Testing

### Option 1: Swagger UI (Recommended for Beginners)

1. Open http://localhost:7878/api-docs
2. Click on any endpoint
3. Click "Try it out"
4. Fill in the parameters
5. Click "Execute"

**For Protected Routes:**
1. First, login via `/api/auth/login`
2. Copy the token from response
3. Click "Authorize" button at top
4. Enter: `Bearer YOUR_TOKEN_HERE`
5. Now you can access protected routes

### Option 2: Postman

1. Import the Postman collection: `FoodMonk.postman_collection.json`
2. Set the environment variable `base_url` to `http://localhost:7878`
3. Run the "Login" request first
4. Token will be automatically saved
5. All other requests will use the saved token

### Option 3: cURL

See `API_TESTING_GUIDE.md` for complete cURL examples.

### Option 4: Socket.io Testing

Create a simple HTML file to test real-time features:

```html
<!DOCTYPE html>
<html>
<head>
    <title>Socket.io Test</title>
    <script src="https://cdn.socket.io/4.6.0/socket.io.min.js"></script>
</head>
<body>
    <h1>Socket.io Test</h1>
    <div id="messages"></div>
    
    <script>
        const socket = io('http://localhost:7878');
        
        socket.on('connect', () => {
            console.log('Connected:', socket.id);
            // Join a restaurant room (replace with actual restaurant ID)
            socket.emit('join-restaurant', 'your-restaurant-id');
        });
        
        socket.on('order-created', (data) => {
            console.log('New order:', data);
            document.getElementById('messages').innerHTML += 
                '<p>New Order: ' + data.orderNumber + '</p>';
        });
    </script>
</body>
</html>
```

## 📁 Project Structure

```
foodmonk-backend/
├── src/
│   ├── config/              # Configuration files
│   │   ├── config.js        # App configuration
│   │   ├── database.js      # MongoDB connection
│   │   └── swagger.js       # Swagger documentation config
│   ├── features/            # Feature-based modules
│   │   ├── auth/            # Authentication (login, register, password)
│   │   │   ├── auth.controller.js
│   │   │   ├── auth.service.js
│   │   │   └── auth.routes.js
│   │   ├── restaurant/      # Restaurant management
│   │   ├── food/            # Food CRUD operations
│   │   ├── table/           # Table management
│   │   ├── order/           # Order management
│   │   ├── public/          # Public customer endpoints
│   │   └── payment/         # Payment gateway integration
│   ├── middlewares/         # Custom middlewares
│   │   ├── auth.js          # JWT authentication
│   │   ├── validate.js      # Request validation
│   │   └── errorHandler.js  # Global error handler
│   ├── models/              # Mongoose models
│   │   ├── Owner.js
│   │   ├── Restaurant.js
│   │   ├── Food.js
│   │   ├── Table.js
│   │   └── Order.js
│   ├── validators/          # Joi validation schemas
│   ├── utils/               # Utility functions
│   ├── sockets/             # Socket.io handlers
│   ├── app.js               # Express app setup
│   └── server.js            # Server entry point
├── uploads/                 # Uploaded files directory
├── .env                     # Environment variables
├── .env.example             # Environment variables template
├── .gitignore              # Git ignore rules
├── package.json            # Dependencies and scripts
├── seed.js                 # Database seeder
├── README.md               # Project documentation
├── API_TESTING_GUIDE.md    # API testing guide
└── SETUP_GUIDE.md          # This file
```

## ✨ Features

### 🔐 Authentication
- Owner registration and login
- JWT-based authentication
- Password change functionality
- Master password for account recovery

### 🏪 Restaurant Management
- CRUD operations for restaurant details
- Logo upload and management
- Opening hours configuration
- Contact information

### 🍕 Food Management
- Create, read, update, delete food items
- Image upload for food items
- Category-based organization
- Availability toggle
- Spice level and vegetarian options
- Preparation time estimation

### 🪑 Table Management
- Create tables with unique URLs
- QR code support (URL can be converted to QR)
- Table capacity and location
- Active/inactive status

### 📱 Customer Ordering
- Public URL for each table
- View restaurant and menu
- Place orders with multiple items
- Special instructions support
- Cash or online payment

### 💳 Payment Integration
- SSLCommerz Bangladesh payment gateway
- Sandbox mode for testing
- Automatic payment callbacks
- Payment status tracking

### ⚡ Real-time Updates
- Socket.io integration
- Live order notifications for owners
- Real-time order status updates for customers
- Estimated time updates

### 📊 Order Management
- View all orders with filters
- Order status management
- Set estimated preparation time
- Order statistics and analytics
- Status history tracking

## 🔍 Troubleshooting

### MongoDB Connection Error

**Error:** `MongoServerError: connect ECONNREFUSED`

**Solution:**
```bash
# Check if MongoDB is running
ps aux | grep mongod

# Start MongoDB
brew services start mongodb-community  # macOS
sudo systemctl start mongod            # Linux
```

### Port Already in Use

**Error:** `EADDRINUSE: address already in use :::7878`

**Solution:**
```bash
# Find and kill the process using port 7878
lsof -ti:7878 | xargs kill -9

# Or change PORT in .env file
PORT=5001
```

### JWT Token Invalid

**Error:** `Invalid or expired token`

**Solution:**
- Login again to get a new token
- Check if token is properly included in Authorization header: `Bearer YOUR_TOKEN`
- Verify JWT_SECRET in .env matches the one used to generate the token

### File Upload Error

**Error:** `MulterError: File too large`

**Solution:**
- Check file size (max 5MB by default)
- Update MAX_FILE_SIZE in .env if needed
- Ensure uploads directory exists and has write permissions

### SSLCommerz Payment Error

**Error:** `Payment gateway error`

**Solution:**
- Verify SSLCOMMERZ_STORE_ID and SSLCOMMERZ_STORE_PASSWORD in .env
- Ensure SSLCOMMERZ_IS_LIVE=false for sandbox testing
- Check internet connection (payment gateway needs to connect to SSLCommerz)

### Socket.io Not Connecting

**Solution:**
- Verify server is running
- Check CORS settings in app.js
- Test connection using the provided HTML test file
- Check browser console for errors

## 📚 Additional Resources

- **API Documentation**: http://localhost:7878/api-docs
- **API Testing Guide**: See `API_TESTING_GUIDE.md`
- **Postman Collection**: Import `FoodMonk.postman_collection.json`

## 🛡️ Security Notes

### For Production Deployment:

1. **Change all secrets:**
   ```env
   JWT_SECRET=use-a-long-random-string-here
   MASTER_PASSWORD=ComplexPassword123!@#
   ```

2. **Use environment-specific .env files:**
   - Never commit .env to git
   - Use environment variables in production
   - Consider using services like AWS Secrets Manager

3. **Enable HTTPS:**
   - Use SSL/TLS certificates
   - Update BASE_URL to https://

4. **Update CORS settings:**
   ```javascript
   // In src/app.js
   app.use(cors({
     origin: 'https://yourdomain.com'
   }));
   ```

5. **Set appropriate rate limits:**
   ```env
   RATE_LIMIT_MAX_REQUESTS=50  # Lower for production
   ```

6. **Use production MongoDB:**
   ```env
   MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/dbname
   ```

7. **Enable SSLCommerz live mode:**
   ```env
   SSLCOMMERZ_IS_LIVE=true
   SSLCOMMERZ_STORE_ID=your-live-store-id
   SSLCOMMERZ_STORE_PASSWORD=your-live-password
   ```

## 🤝 Support

If you encounter any issues:

1. Check this guide's troubleshooting section
2. Review the error logs in the console
3. Check MongoDB logs
4. Verify all environment variables are set correctly
5. Ensure all dependencies are installed: `npm install`

## 📝 Quick Start Checklist

- [ ] Node.js and MongoDB installed
- [ ] Dependencies installed (`npm install`)
- [ ] MongoDB running
- [ ] .env file configured
- [ ] Database seeded (`npm run seed`)
- [ ] Server started (`npm run dev`)
- [ ] Swagger docs accessible (http://localhost:7878/api-docs)
- [ ] Successfully logged in and got JWT token
- [ ] Tested at least one protected endpoint

**Congratulations! Your FoodMonk Restaurant Backend is ready! 🎉**
