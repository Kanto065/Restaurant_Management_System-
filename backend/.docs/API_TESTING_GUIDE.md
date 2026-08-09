# FoodMonk API Testing Guide

This guide will help you test all the API endpoints using tools like Postman, Insomnia, or curl.

## Base URL
```
http://localhost:7878
```

## 1. Authentication

### Register Owner (First Time Setup)
```bash
POST /api/auth/register
Content-Type: application/json

{
  "username": "admin",
  "password": "admin123"
}
```

### Login
```bash
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "admin123"
}

# Response will include a JWT token
# Use this token in subsequent requests
```

### Change Password
```bash
POST /api/auth/change-password
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "currentPassword": "admin123",
  "newPassword": "newpassword123",
  "confirmPassword": "newpassword123"
}
```

### Reset Password with Master Password
```bash
POST /api/auth/reset-password
Content-Type: application/json

{
  "masterPassword": "AdminMaster@123",
  "username": "admin",
  "newPassword": "resetpassword123"
}
```

### Get Current Owner Profile
```bash
GET /api/auth/me
Authorization: Bearer YOUR_JWT_TOKEN
```

## 2. Restaurant Management

### Get Restaurant Details
```bash
GET /api/restaurant
Authorization: Bearer YOUR_JWT_TOKEN
```

### Update Restaurant Details
```bash
PUT /api/restaurant
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "name": "The Hungry Kitchen",
  "description": "Best restaurant in town",
  "phone": "+880-1712-345678",
  "email": "info@restaurant.com",
  "address": {
    "street": "123 Food Street",
    "city": "Dhaka",
    "state": "Dhaka",
    "zipCode": "1205",
    "country": "Bangladesh"
  },
  "openingHours": {
    "monday": { "open": "11:00 AM", "close": "11:00 PM" },
    "tuesday": { "open": "11:00 AM", "close": "11:00 PM" }
  }
}
```

### Upload Restaurant Logo
```bash
POST /api/restaurant/logo
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: multipart/form-data

# Form Data:
logo: [Select an image file]
```

### Delete Restaurant Logo
```bash
DELETE /api/restaurant/logo
Authorization: Bearer YOUR_JWT_TOKEN
```

## 3. Food Management

### Get All Foods
```bash
GET /api/foods
Authorization: Bearer YOUR_JWT_TOKEN

# With filters:
GET /api/foods?category=Main Course&isAvailable=true&isVegetarian=false
```

### Get Food by ID
```bash
GET /api/foods/{foodId}
Authorization: Bearer YOUR_JWT_TOKEN
```

### Create Food
```bash
POST /api/foods
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: multipart/form-data

# Form Data:
name: Chicken Biryani
description: Delicious aromatic rice with chicken
price: 350
category: Main Course
isVegetarian: false
isAvailable: true
preparationTime: 30
spiceLevel: Medium
image: [Select an image file]
```

### Update Food
```bash
PUT /api/foods/{foodId}
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: multipart/form-data

# Form Data:
name: Updated Chicken Biryani
price: 375
isAvailable: true
image: [Select new image file if updating]
```

### Delete Food
```bash
DELETE /api/foods/{foodId}
Authorization: Bearer YOUR_JWT_TOKEN
```

## 4. Table Management

### Get All Tables
```bash
GET /api/tables
Authorization: Bearer YOUR_JWT_TOKEN
```

### Get Table by ID
```bash
GET /api/tables/{tableId}
Authorization: Bearer YOUR_JWT_TOKEN
```

### Create Table
```bash
POST /api/tables
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "tableNumber": "T-01",
  "capacity": 4,
  "location": "Window Side"
}
```

### Update Table
```bash
PUT /api/tables/{tableId}
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "tableNumber": "T-01",
  "capacity": 6,
  "location": "Main Hall",
  "isActive": true
}
```

### Delete Table
```bash
DELETE /api/tables/{tableId}
Authorization: Bearer YOUR_JWT_TOKEN
```

## 5. Order Management

### Get Order Statistics
```bash
GET /api/orders/stats
Authorization: Bearer YOUR_JWT_TOKEN
```

### Get All Orders
```bash
GET /api/orders
Authorization: Bearer YOUR_JWT_TOKEN

# With filters:
GET /api/orders?status=pending&paymentMethod=cash
```

### Get Order by ID
```bash
GET /api/orders/{orderId}
Authorization: Bearer YOUR_JWT_TOKEN
```

### Update Order Status
```bash
PUT /api/orders/{orderId}/status
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "status": "confirmed",
  "note": "Order confirmed and being prepared"
}

# Status options: pending, confirmed, preparing, ready, served, completed, cancelled
```

### Set Estimated Time
```bash
PUT /api/orders/{orderId}/estimated-time
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "estimatedTime": 25
}
```

## 6. Public Endpoints (Customer-Facing)

### Get Table Details with Menu
```bash
GET /api/public/table/{tableUrl}

# No authentication required
# tableUrl is the unique URL generated for each table
```

### Place Order (Customer)
```bash
POST /api/public/orders
Content-Type: application/json

{
  "tableUrl": "abc123-def456-ghi789",
  "items": [
    {
      "food": "foodId1",
      "quantity": 2,
      "specialInstructions": "Extra spicy please"
    },
    {
      "food": "foodId2",
      "quantity": 1
    }
  ],
  "customerName": "John Doe",
  "customerPhone": "+8801712345678",
  "paymentMethod": "cash",
  "specialRequests": "Please serve hot"
}

# paymentMethod: "cash" or "online"
# If "online", response will include paymentGatewayUrl
```

### Get Order Status (Customer)
```bash
GET /api/public/orders/{orderNumber}

# No authentication required
# orderNumber is returned when placing order (e.g., ORD-20241029-ABC123)
```

## 7. Socket.io Testing

### Connect to Socket.io
```javascript
// Using socket.io-client
const socket = io('http://localhost:7878');

// Owner joins restaurant room
socket.emit('join-restaurant', 'restaurantId');

// Customer joins order room
socket.emit('join-order', 'orderId');

// Listen for events
socket.on('order-created', (data) => {
  console.log('New order:', data);
});

socket.on('order-status-updated', (data) => {
  console.log('Order status updated:', data);
});

socket.on('order-time-updated', (data) => {
  console.log('Estimated time updated:', data);
});
```

## 8. Testing Payment Flow

### Online Payment Flow
1. Customer places order with `paymentMethod: "online"`
2. API returns `paymentGatewayUrl` in response
3. Customer is redirected to SSLCommerz payment page
4. After payment, SSLCommerz redirects to success/fail callback
5. Order payment status is automatically updated

### Test Payment Credentials (SSLCommerz Sandbox)
```
Store ID: testbox
Store Password: qwerty

Test Card:
Card Number: 4111111111111111
Expiry: Any future date
CVV: 123
```

## 9. Swagger Documentation

Access the interactive API documentation at:
```
http://localhost:7878/api-docs
```

You can test all endpoints directly from the Swagger UI.

## 10. Common Response Formats

### Success Response
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Success message",
  "data": {
    // Response data
  }
}
```

### Error Response
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Error message"
}
```

## Tips for Testing

1. **Start MongoDB** before running the server
2. **Run the seeder** to populate initial data: `node seed.js`
3. **Get JWT token** from login response and use it in Authorization header
4. **Save table URLs** from table creation/list to test customer ordering
5. **Test Socket.io** using the provided client code or tools like Socket.io Client Tool
6. **Use Swagger UI** for easy testing with built-in request forms

## Environment Variables

Make sure your `.env` file is properly configured:
```env
NODE_ENV=development
PORT=7878
BASE_URL=http://localhost:7878
MONGODB_URI=mongodb://localhost:27017/foodmonk
JWT_SECRET=your_secret_key
MASTER_PASSWORD=YourMasterPassword
SSLCOMMERZ_STORE_ID=testbox
SSLCOMMERZ_STORE_PASSWORD=qwerty
SSLCOMMERZ_IS_LIVE=false
```
