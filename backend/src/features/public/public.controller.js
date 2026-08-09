import asyncHandler from '../../utils/asyncHandler.js';
import ApiResponse from '../../utils/ApiResponse.js';
import publicService from './public.service.js';

class PublicController {
  /**
   * @desc    Get table details with menu
   * @route   GET /api/public/table/:tableUrl
   * @access  Public
   */
  getTableDetails = asyncHandler(async (req, res) => {
    const result = await publicService.getTableDetails(req.params.tableUrl);
    
    res.status(200).json(
      new ApiResponse(200, result, 'Table details fetched successfully')
    );
  });
  
  /**
   * @desc    Place order
   * @route   POST /api/public/orders
   * @access  Public
   */
  placeOrder = asyncHandler(async (req, res) => {
    const io = req.app.get('io');
    const result = await publicService.placeOrder(req.body, io);
    
    res.status(201).json(
      new ApiResponse(201, result, 'Order placed successfully')
    );
  });
  
  /**
   * @desc    Get order status
   * @route   GET /api/public/orders/:orderNumber
   * @access  Public
   */
  getOrderStatus = asyncHandler(async (req, res) => {
    const order = await publicService.getOrderStatus(req.params.orderNumber);
    
    res.status(200).json(
      new ApiResponse(200, { order }, 'Order status fetched successfully')
    );
  });

  /**
   * @desc    Get customer orders by phone number
   * @route   GET /api/public/orders/search/:phone
   * @access  Public
   */
  getOrdersByPhone = asyncHandler(async (req, res) => {
    const result = await publicService.getOrdersByPhone(req.params.phone);
    
    res.status(200).json(
      new ApiResponse(200, result, 'Orders fetched successfully')
    );
  });

  /**
   * @desc    Get all active menus for a restaurant
   * @route   GET /api/public/table/:tableUrl/menus
   * @access  Public
   */
  getRestaurantMenus = asyncHandler(async (req, res) => {
    const result = await publicService.getRestaurantMenus(req.params.tableUrl);
    
    res.status(200).json(
      new ApiResponse(200, result, 'Menus fetched successfully')
    );
  });

  /**
   * @desc    Get specific menu details with foods
   * @route   GET /api/public/table/:tableUrl/menus/:menuId
   * @access  Public
   */
  getMenuDetails = asyncHandler(async (req, res) => {
    const result = await publicService.getMenuDetails(req.params.tableUrl, req.params.menuId);
    
    res.status(200).json(
      new ApiResponse(200, result, 'Menu details fetched successfully')
    );
  });
}

export default new PublicController();
