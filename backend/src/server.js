import { createServer } from 'http';
import { Server } from 'socket.io';
import app from './app.js';
import config from './config/config.js';
import connectDB from './config/database.js';
import setupSocketHandlers from './sockets/socketHandlers.js';

// Create HTTP server
const httpServer = createServer(app);

// Initialize Socket.io
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Setup Socket.io handlers
setupSocketHandlers(io);

// Make io available to routes
app.set('io', io);

// Connect to database
connectDB();

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Promise Rejection:', err);
  // Close server & exit process
  httpServer.close(() => process.exit(1));
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  // Close server & exit process
  httpServer.close(() => process.exit(1));
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('👋 SIGTERM received. Shutting down gracefully...');
  httpServer.close(() => {
    console.log('✅ Process terminated');
  });
});

// Start server
const PORT = config.port || 7878;

httpServer.listen(PORT, () => {
  console.log('');
  console.log(`Server running in ${config.env} mode on port ${PORT}`);
  console.log(`API Documentation: ${config.baseUrl}/api-docs`);
  console.log(`Health Check: ${config.baseUrl}/health`);
  console.log(`Socket.io: Connected and ready`);
  console.log('');
  console.log('Press CTRL+C to stop the server');
  console.log('');
});

export default httpServer;
