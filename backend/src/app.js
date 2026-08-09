import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import path from 'path';
import { fileURLToPath } from 'url';

import config from './config/config.js';
import swaggerSpec from './config/swagger.js';
import errorHandler from './middlewares/errorHandler.js';

// Import routes
import authRoutes from './features/auth/auth.routes.js';
import restaurantRoutes from './features/restaurant/restaurant.routes.js';
import foodRoutes from './features/food/food.routes.js';
import tableRoutes from './features/table/table.routes.js';
import orderRoutes from './features/order/order.routes.js';
import publicRoutes from './features/public/public.routes.js';
import notificationRoutes from './features/notification/notification.routes.js';
import menuRoutes from './features/menu/menu.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(cors());

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging middleware
if (config.env === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});

// Apply rate limiting to all routes
app.use('/api/', limiter);

// Serve uploaded images
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Takeout API Documentation'
}));

// Health check route
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date(),
    environment: config.env
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/restaurant', restaurantRoutes);
app.use('/api/foods', foodRoutes);
app.use('/api/tables', tableRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/menus', menuRoutes);

// Welcome route
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Welcome to Takeout Restaurant Backend API',
    version: '1.0.0',
    documentation: `${config.baseUrl}/api-docs`,
    endpoints: {
      health: '/health',
      docs: '/api-docs',
      auth: '/api/auth',
      restaurant: '/api/restaurant',
      foods: '/api/foods',
      tables: '/api/tables',
      orders: '/api/orders',
      public: '/api/public',
      notifications: '/api/notifications',
      menus: '/api/menus'
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.originalUrl
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

export default app;
