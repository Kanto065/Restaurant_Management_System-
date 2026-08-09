import asyncHandler from '../../utils/asyncHandler.js';
import ApiResponse from '../../utils/ApiResponse.js';
import restaurantService from './restaurant.service.js';

class RestaurantController {
  /**
   * @desc    Get restaurant details
   * @route   GET /api/restaurant
   * @access  Private
   */
  getRestaurant = asyncHandler(async (req, res) => {
    const restaurant = await restaurantService.getRestaurant(req.owner._id);
    
    res.status(200).json(
      new ApiResponse(200, { restaurant }, 'Restaurant fetched successfully')
    );
  });
  
  /**
   * @desc    Update restaurant details
   * @route   PUT /api/restaurant
   * @access  Private
   */
  updateRestaurant = asyncHandler(async (req, res) => {
    const restaurant = await restaurantService.updateRestaurant(
      req.owner._id,
      req.body
    );
    
    res.status(200).json(
      new ApiResponse(200, { restaurant }, 'Restaurant updated successfully')
    );
  });
  
  /**
   * @desc    Upload restaurant logo
   * @route   POST /api/restaurant/logo
   * @access  Private
   */
  uploadLogo = asyncHandler(async (req, res) => {
    const result = await restaurantService.uploadLogo(req.owner._id, req.file);
    
    res.status(200).json(
      new ApiResponse(200, result, 'Logo uploaded successfully')
    );
  });
  
  /**
   * @desc    Delete restaurant logo
   * @route   DELETE /api/restaurant/logo
   * @access  Private
   */
  deleteLogo = asyncHandler(async (req, res) => {
    const result = await restaurantService.deleteLogo(req.owner._id);
    
    res.status(200).json(
      new ApiResponse(200, result, 'Logo deleted successfully')
    );
  });
}

export default new RestaurantController();
