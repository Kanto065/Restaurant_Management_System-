import asyncHandler from '../../utils/asyncHandler.js';
import ApiResponse from '../../utils/ApiResponse.js';
import authService from './auth.service.js';

class AuthController {
  /**
   * @desc    Login owner
   * @route   POST /api/auth/login
   * @access  Public
   */
  login = asyncHandler(async (req, res) => {
    const { username, password } = req.body;
    
    const result = await authService.login(username, password);
    
    res.status(200).json(
      new ApiResponse(200, result, 'Login successful')
    );
  });
  
  /**
   * @desc    Register owner (initial setup)
   * @route   POST /api/auth/register
   * @access  Public
   */
  register = asyncHandler(async (req, res) => {
    const { username, password } = req.body;
    
    const result = await authService.register(username, password);
    
    res.status(201).json(
      new ApiResponse(201, result, 'Registration successful')
    );
  });
  
  /**
   * @desc    Change password
   * @route   POST /api/auth/change-password
   * @access  Private
   */
  changePassword = asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    
    const result = await authService.changePassword(
      req.owner._id,
      currentPassword,
      newPassword
    );
    
    res.status(200).json(
      new ApiResponse(200, result, 'Password changed successfully')
    );
  });
  
  /**
   * @desc    Reset password with master password
   * @route   POST /api/auth/reset-password
   * @access  Public
   */
  resetPassword = asyncHandler(async (req, res) => {
    const { masterPassword, username, newPassword } = req.body;
    
    const result = await authService.resetPassword(
      masterPassword,
      username,
      newPassword
    );
    
    res.status(200).json(
      new ApiResponse(200, result, 'Password reset successfully')
    );
  });
  
  /**
   * @desc    Get current owner profile
   * @route   GET /api/auth/me
   * @access  Private
   */
  getMe = asyncHandler(async (req, res) => {
    res.status(200).json(
      new ApiResponse(200, { owner: req.owner }, 'Profile fetched successfully')
    );
  });
}

export default new AuthController();
