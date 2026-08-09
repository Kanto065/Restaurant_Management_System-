import dotenv from 'dotenv';

dotenv.config();

const config = {
  env: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 7878,
  baseUrl: process.env.BASE_URL || 'http://localhost:7878',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:8081',
  
  database: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/foodmonk'
  },
  
  jwt: {
    secret: process.env.JWT_SECRET || 'your_jwt_secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  },
  
  masterPassword: process.env.MASTER_PASSWORD || 'MasterPass123!',

  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024,
    uploadPath: (process.env.UPLOAD_PATH || 'uploads').replace(/﻿/g, '').trim()
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100
  }
};

export default config;
