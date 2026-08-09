import Owner from '../../models/Owner.js';
import Restaurant from '../../models/Restaurant.js';
import { generateToken } from '../../utils/jwt.js';
import AppError from '../../utils/AppError.js';
import config from '../../config/config.js';

class AuthService {
  /**
   * Login owner
   */
  async login(username, password) {
    // Find owner
    const owner = await Owner.findOne({ username });
    
    if (!owner) {
      throw new AppError('Invalid credentials', 401);
    }
    
    // Check if account is active
    if (!owner.isActive) {
      throw new AppError('Account is deactivated', 403);
    }
    
    // Verify password
    const isPasswordValid = await owner.comparePassword(password);
    
    if (!isPasswordValid) {
      throw new AppError('Invalid credentials', 401);
    }
    
    // Update last login
    await owner.updateLastLogin();
    
    // Generate token
    const token = generateToken({ id: owner._id, username: owner.username });
    
    return {
      owner: owner.toJSON(),
      token
    };
  }
  
  /**
   * Change password
   */
  async changePassword(ownerId, currentPassword, newPassword) {
    // Find owner
    const owner = await Owner.findById(ownerId);
    
    if (!owner) {
      throw new AppError('Owner not found', 404);
    }
    
    // Verify current password
    const isPasswordValid = await owner.comparePassword(currentPassword);
    
    if (!isPasswordValid) {
      throw new AppError('Current password is incorrect', 401);
    }
    
    // Update password
    owner.password = newPassword;
    await owner.save();
    
    return { message: 'Password changed successfully' };
  }
  
  /**
   * Reset password with master password
   */
  async resetPassword(masterPassword, username, newPassword) {
    // Verify master password
    if (masterPassword !== config.masterPassword) {
      throw new AppError('Invalid master password', 401);
    }
    
    // Find owner
    const owner = await Owner.findOne({ username });
    
    if (!owner) {
      throw new AppError('Owner not found', 404);
    }
    
    // Update password
    owner.password = newPassword;
    await owner.save();
    
    return { message: 'Password reset successfully' };
  }
  
  /**
   * Register owner (initial setup)
   */
  async register(username, password) {
    // Check if owner already exists
    const existingOwner = await Owner.findOne({ username });
    
    if (existingOwner) {
      throw new AppError('Username already exists', 400);
    }
    
    // Create owner
    const owner = await Owner.create({ username, password });
    
    // Create default restaurant
    await Restaurant.create({
      owner: owner._id,
      name: 'My Restaurant',
      description: 'Welcome to my restaurant'
    });
    
    // Generate token
    const token = generateToken({ id: owner._id, username: owner.username });
    
    return {
      owner: owner.toJSON(),
      token
    };
  }
}

export default new AuthService();
