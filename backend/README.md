# FoodMonk Backend

A comprehensive restaurant management backend with real-time order tracking, built with Node.js, Express, MongoDB, and Socket.io.

## Features

- 🔐 **Owner Authentication** - JWT-based authentication with master password support
- 🍽️ **Restaurant Management** - Manage restaurant details, logo, and information
- 🍕 **Food Management** - CRUD operations for menu items with image uploads
- 🪑 **Table Management** - Generate unique URLs for each table
- 📱 **Customer Ordering** - Public URLs for customers to view menu and place orders
- 💳 **Payment Integration** - SSLCommerz (Bangladesh) payment gateway integration
- ⚡ **Real-time Updates** - Socket.io for live order status tracking
- 📚 **API Documentation** - Comprehensive Swagger documentation

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose
- **Authentication**: JWT (JSON Web Tokens)
- **Real-time**: Socket.io
- **File Upload**: Multer
- **Payment**: SSLCommerz
- **Documentation**: Swagger (OpenAPI 3.0)
- **Security**: Helmet, CORS, Rate Limiting

## Installation

1. Clone the repository
```bash
git clone <repository-url>
cd foodmonk-backend
```

2. Install dependencies
```bash
npm install
```

3. Configure environment variables
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Start MongoDB (if running locally)
```bash
mongod
```

5. Run the application
```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start
```

## Environment Variables

See `.env.example` for all required environment variables.

## API Documentation

Once the server is running, access the Swagger documentation at:
```
http://localhost:7878/api-docs
```

## Project Structure

```
src/
├── config/          # Configuration files
├── features/        # Feature-based modules
│   ├── auth/        # Authentication
│   ├── owner/       # Owner management
│   ├── restaurant/  # Restaurant management
│   ├── food/        # Food management
│   ├── table/       # Table management
│   ├── order/       # Order management
│   └── payment/     # Payment processing
├── middlewares/     # Custom middlewares
├── models/          # Mongoose models
├── utils/           # Utility functions
├── validators/      # Request validators
├── sockets/         # Socket.io handlers
├── app.js           # Express app setup
└── server.js        # Server entry point
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - Owner login
- `POST /api/auth/change-password` - Change password
- `POST /api/auth/reset-password` - Reset with master password

### Restaurant Management
- `GET /api/restaurant` - Get restaurant details
- `PUT /api/restaurant` - Update restaurant details
- `POST /api/restaurant/logo` - Upload restaurant logo

### Food Management
- `GET /api/foods` - Get all foods
- `POST /api/foods` - Create new food item
- `PUT /api/foods/:id` - Update food item
- `DELETE /api/foods/:id` - Delete food item

### Table Management
- `GET /api/tables` - Get all tables
- `POST /api/tables` - Create new table
- `PUT /api/tables/:id` - Update table
- `DELETE /api/tables/:id` - Delete table

### Customer (Public)
- `GET /api/public/table/:tableUrl` - Get table details with menu
- `POST /api/public/orders` - Place order

### Order Management
- `GET /api/orders` - Get all orders
- `GET /api/orders/:id` - Get order details
- `PUT /api/orders/:id/status` - Update order status
- `PUT /api/orders/:id/estimated-time` - Set estimated time

## Socket.io Events

### Client → Server
- `join-restaurant` - Join restaurant room
- `join-order` - Join specific order room

### Server → Client
- `order-created` - New order notification
- `order-status-updated` - Order status changed
- `order-time-updated` - Estimated time updated

## Payment Flow

1. Customer selects online payment
2. System initiates SSLCommerz payment session
3. Customer completes payment on SSLCommerz
4. SSLCommerz sends IPN (Instant Payment Notification)
5. System validates and updates order status

## Security Features

- JWT authentication for protected routes
- Password hashing with bcrypt
- Rate limiting to prevent abuse
- Helmet for security headers
- CORS configuration
- Input validation with Joi
- File upload restrictions

## License

ISC
