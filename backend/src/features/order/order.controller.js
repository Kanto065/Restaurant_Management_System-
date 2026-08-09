import asyncHandler from '../../utils/asyncHandler.js';
import ApiResponse from '../../utils/ApiResponse.js';
import orderService from './order.service.js';

class OrderController {
  /**
   * @desc    Get all orders
   * @route   GET /api/orders
   * @access  Private
   */
  getAllOrders = asyncHandler(async (req, res) => {
    const filters = {
      status: req.query.status,
      paymentStatus: req.query.paymentStatus,
      paymentMethod: req.query.paymentMethod
    };
    
    const orders = await orderService.getAllOrders(req.owner._id, filters);
    
    res.status(200).json(
      new ApiResponse(200, { orders, count: orders.length }, 'Orders fetched successfully')
    );
  });
  
  /**
   * @desc    Get order by ID
   * @route   GET /api/orders/:id
   * @access  Private
   */
  getOrderById = asyncHandler(async (req, res) => {
    const order = await orderService.getOrderById(req.owner._id, req.params.id);
    
    res.status(200).json(
      new ApiResponse(200, { order }, 'Order fetched successfully')
    );
  });
  
  /**
   * @desc    Update order status
   * @route   PUT /api/orders/:id/status
   * @access  Private
   */
  updateOrderStatus = asyncHandler(async (req, res) => {
    const { status, note } = req.body;
    const io = req.app.get('io');
    
    const order = await orderService.updateOrderStatus(
      req.owner._id,
      req.params.id,
      status,
      note,
      io
    );
    
    res.status(200).json(
      new ApiResponse(200, { order }, 'Order status updated successfully')
    );
  });
  
  /**
   * @desc    Set estimated time for order
   * @route   PUT /api/orders/:id/estimated-time
   * @access  Private
   */
  setEstimatedTime = asyncHandler(async (req, res) => {
    const { estimatedTime } = req.body;
    const io = req.app.get('io');
    
    const order = await orderService.setEstimatedTime(
      req.owner._id,
      req.params.id,
      estimatedTime,
      io
    );
    
    res.status(200).json(
      new ApiResponse(200, { order }, 'Estimated time set successfully')
    );
  });
  
  /**
   * @desc    Update payment status
   * @route   PUT /api/orders/:id/payment-status
   * @access  Private
   */
  updatePaymentStatus = asyncHandler(async (req, res) => {
    const { paymentStatus } = req.body;
    const io = req.app.get('io');
    
    const order = await orderService.updatePaymentStatus(
      req.owner._id,
      req.params.id,
      paymentStatus,
      io
    );
    
    res.status(200).json(
      new ApiResponse(200, { order }, 'Payment status updated successfully')
    );
  });
  
  /**
   * @desc    Get order statistics
   * @route   GET /api/orders/stats
   * @access  Private
   */
  getOrderStats = asyncHandler(async (req, res) => {
    const stats = await orderService.getOrderStats(req.owner._id);
    
    res.status(200).json(
      new ApiResponse(200, { stats }, 'Order statistics fetched successfully')
    );
  });
}

export default new OrderController();
