# 🚀 FoodMonk Backend - Quick Reference Guide

## ⚡ Quick Commands

```bash
# Development
npm run dev          # Start with auto-reload
npm start            # Start production
npm run seed         # Seed database with sample data
./test-setup.sh      # Verify setup

# Database
mongod               # Start MongoDB
mongosh              # MongoDB shell
```

## 🔑 Default Credentials

```
Username: admin
Password: admin123
Master Password: AdminMaster@123
```

## 📍 Important URLs

```
API Base:           http://localhost:7878
API Docs:           http://localhost:7878/api-docs
Health Check:       http://localhost:7878/health
```

## 🎯 Common API Calls

### 1. Login
```bash
curl -X POST http://localhost:7878/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

### 2. Get Restaurant (Protected)
```bash
curl -X GET http://localhost:7878/api/restaurant \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 3. Create Food with Image
```bash
curl -X POST http://localhost:7878/api/foods \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "name=Chicken Curry" \
  -F "price=350" \
  -F "category=Main Course" \
  -F "image=@/path/to/image.jpg"
```

### 4. Create Table
```bash
curl -X POST http://localhost:7878/api/tables \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tableNumber":"T-01","capacity":4}'
```

### 5. Place Order (Public)
```bash
curl -X POST http://localhost:7878/api/public/orders \
  -H "Content-Type: application/json" \
  -d '{
    "tableUrl":"YOUR_TABLE_URL",
    "items":[{"food":"FOOD_ID","quantity":2}],
    "paymentMethod":"cash"
  }'
```

## 🔐 Authentication Header

All protected routes require:
```
Authorization: Bearer YOUR_JWT_TOKEN
```

## 📊 Response Format

### Success
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Success message",
  "data": { /* response data */ }
}
```

### Error
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Error message"
}
```

## 🎨 Order Status Values

```
pending    → Order received
confirmed  → Owner confirmed
preparing  → Being prepared
ready      → Ready to serve
served     → Delivered to table
completed  → Order complete
cancelled  → Order cancelled
```

## 💳 Payment Methods

```
cash       → Pay at restaurant
online     → SSLCommerz gateway
```

## 🍽️ Food Categories

```
Appetizer
Main Course
Dessert
Beverage
Snack
Other
```

## 🌶️ Spice Levels

```
None
Mild
Medium
Hot
Extra Hot
```

## 📱 Socket.io Client Example

```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:7878');

// Owner joins restaurant room
socket.emit('join-restaurant', 'restaurantId');

// Listen for new orders
socket.on('order-created', (data) => {
  console.log('New order:', data);
});

// Customer joins order room
socket.emit('join-order', 'orderId');

// Listen for status updates
socket.on('order-status-updated', (data) => {
  console.log('Status:', data.status);
});
```

## 🔧 Environment Variables

```env
# Essential
PORT=7878
MONGODB_URI=mongodb://localhost:27017/foodmonk
JWT_SECRET=your_secret_key
MASTER_PASSWORD=your_master_password

# Payment (SSLCommerz)
SSLCOMMERZ_STORE_ID=testbox
SSLCOMMERZ_STORE_PASSWORD=qwerty
SSLCOMMERZ_IS_LIVE=false
```

## 📁 File Locations

```
Uploads:        /uploads/
Logs:           Console output
Database:       MongoDB foodmonk database
Config:         /src/config/
Models:         /src/models/
Features:       /src/features/
```

## 🐛 Common Issues & Fixes

### MongoDB not connecting
```bash
# Check if MongoDB is running
ps aux | grep mongod

# Start MongoDB
brew services start mongodb-community  # macOS
sudo systemctl start mongod            # Linux
```

### Port already in use
```bash
# Kill process on port 7878
lsof -ti:7878 | xargs kill -9
```

### JWT token expired
```bash
# Login again to get new token
curl -X POST http://localhost:7878/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

### File upload failing
```bash
# Check uploads directory exists
mkdir -p uploads

# Check file size (max 5MB)
ls -lh your-file.jpg
```

## 📦 npm Scripts

```json
"scripts": {
  "start": "node src/server.js",      // Production
  "dev": "nodemon src/server.js",     // Development
  "seed": "node seed.js"              // Seed DB
}
```

## 🔍 Debugging Tips

### View all collections
```javascript
// In mongosh
use foodmonk
show collections
db.owners.find()
db.restaurants.find()
db.foods.find()
db.tables.find()
db.orders.find()
```

### Check JWT token
```javascript
// Decode JWT (no verification)
const jwt = require('jsonwebtoken');
const decoded = jwt.decode('YOUR_TOKEN');
console.log(decoded);
```

### Test Socket.io connection
```javascript
// In browser console
const socket = io('http://localhost:7878');
socket.on('connect', () => console.log('Connected!'));
```

## 📊 Database Queries

### Find active foods
```javascript
db.foods.find({ isAvailable: true })
```

### Find pending orders
```javascript
db.orders.find({ orderStatus: 'pending' })
```

### Find tables by restaurant
```javascript
db.tables.find({ restaurant: ObjectId('...') })
```

### Count orders by status
```javascript
db.orders.aggregate([
  { $group: { _id: '$orderStatus', count: { $sum: 1 } } }
])
```

## 🎯 Testing Workflow

1. **Start MongoDB**
   ```bash
   mongod
   ```

2. **Seed Database**
   ```bash
   npm run seed
   ```

3. **Start Server**
   ```bash
   npm run dev
   ```

4. **Test Login** (Swagger UI)
   - Open http://localhost:7878/api-docs
   - Try POST /api/auth/login
   - Copy token

5. **Authorize**
   - Click "Authorize" button
   - Enter: `Bearer YOUR_TOKEN`

6. **Test Endpoints**
   - Try creating foods, tables
   - Get table URL
   - Test public order endpoint

## 📱 Mobile App Integration

### Base URL
```
http://YOUR_SERVER_IP:7878
```

### WebSocket URL
```
ws://YOUR_SERVER_IP:7878
```

### Example Headers
```javascript
headers: {
  'Authorization': 'Bearer ' + token,
  'Content-Type': 'application/json'
}
```

## 🌐 Production Deployment

### Quick Checklist
- [ ] Update all secrets in .env
- [ ] Set NODE_ENV=production
- [ ] Use MongoDB Atlas or similar
- [ ] Enable HTTPS
- [ ] Update CORS origins
- [ ] Use process manager (PM2)
- [ ] Set up monitoring
- [ ] Configure backups

### PM2 Commands
```bash
pm2 start src/server.js --name foodmonk
pm2 logs foodmonk
pm2 restart foodmonk
pm2 stop foodmonk
```

## 📞 API Endpoints Summary

```
Auth:        5 endpoints
Restaurant:  4 endpoints
Foods:       5 endpoints
Tables:      5 endpoints
Orders:      5 endpoints
Public:      3 endpoints
Payment:     4 endpoints
Utility:     2 endpoints
────────────────────────
Total:      33 endpoints
```

## 🎪 Demo Scenario

1. **Owner registers and logs in**
2. **Updates restaurant details**
3. **Uploads logo**
4. **Creates 5 food items with images**
5. **Creates 3 tables**
6. **Gets table URL**
7. **Customer visits table URL**
8. **Places order with 3 items**
9. **Chooses cash payment**
10. **Owner receives real-time notification**
11. **Owner updates order status to confirmed**
12. **Sets estimated time: 25 minutes**
13. **Customer sees real-time updates**
14. **Owner updates to preparing, ready, served**
15. **Order completed!**

## 💡 Pro Tips

1. **Use Swagger UI for testing** - Easiest way to explore API
2. **Import Postman collection** - Pre-configured requests
3. **Run seed script** - Quick sample data
4. **Check Swagger docs** - All endpoints documented
5. **Use Socket.io test page** - Test real-time features
6. **Monitor console** - See all requests and errors
7. **Check MongoDB** - Verify data is saving correctly

## 📚 Documentation Files

```
README.md              - Project overview
SETUP_GUIDE.md        - Complete setup instructions
API_TESTING_GUIDE.md  - How to test APIs
PROJECT_SUMMARY.md    - What was built
ARCHITECTURE.md       - System architecture
QUICK_REFERENCE.md    - This file
```

## 🏆 Success Indicators

✅ Server starts without errors
✅ MongoDB connection successful
✅ Swagger docs accessible
✅ Login returns JWT token
✅ Protected routes work with token
✅ File uploads working
✅ Socket.io connects
✅ Orders can be placed
✅ Real-time updates working

---

**Need help? Check the documentation files or API docs!**
