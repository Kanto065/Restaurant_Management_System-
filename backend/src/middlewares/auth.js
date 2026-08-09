import { verifyToken } from '../utils/jwt.js';
import asyncHandler from '../utils/asyncHandler.js';
import AppError from '../utils/AppError.js';
import Owner from '../models/Owner.js';

/**
 * Protect routes - Verify JWT token
 */
export const protect = asyncHandler(async (req, res, next) => {
  let token;
  
  // Get token from header
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  
  // Check if token exists
  if (!token) {
    throw new AppError('Not authorized to access this route', 401);
  }
  
  // Verify token
  const decoded = verifyToken(token);
  
  if (!decoded) {
    throw new AppError('Invalid or expired token', 401);
  }
  
  // Check if owner exists
  const owner = await Owner.findById(decoded.id);
  
  if (!owner) {
    throw new AppError('Owner not found', 404);
  }
  
  if (!owner.isActive) {
    throw new AppError('Account is deactivated', 403);
  }
  
  // Attach owner to request
  req.owner = owner;
  next();
});
