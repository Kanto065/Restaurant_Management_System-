import Order from '../../models/Order.js';
import Restaurant from '../../models/Restaurant.js';
import Food from '../../models/Food.js';
import AppError from '../../utils/AppError.js';

class OrderService {
  /**
   * Get all orders for owner
   */
  async getAllOrders(ownerId, filters = {}) {
    const restaurant = await Restaurant.findOne({ owner: ownerId });
    
    if (!restaurant) {
      throw new AppError('Restaurant not found', 404);
    }
    
    const query = { restaurant: restaurant._id };
    
    // Apply filters
    if (filters.status) {
      query.orderStatus = filters.status;
    }
    if (filters.paymentStatus) {
      query.paymentStatus = filters.paymentStatus;
    }
    if (filters.paymentMethod) {
      query.paymentMethod = filters.paymentMethod;
    }
    
    const orders = await Order.find(query)
      .populate('table', 'tableNumber location')
      .populate('items.food', 'name category')
      .sort({ createdAt: -1 });
    
    return orders;
  }
  
  /**
   * Get order by ID
   */
  async getOrderById(ownerId, orderId) {
    const restaurant = await Restaurant.findOne({ owner: ownerId });
    
    if (!restaurant) {
      throw new AppError('Restaurant not found', 404);
    }
    
    const order = await Order.findOne({ _id: orderId, restaurant: restaurant._id })
      .populate('table', 'tableNumber location capacity')
      .populate('items.food', 'name category image');
    
    if (!order) {
      throw new AppError('Order not found', 404);
    }
    
    return order;
  }
  
  /**
   * Update order status
   */
  async updateOrderStatus(ownerId, orderId, status, note, io) {
    const restaurant = await Restaurant.findOne({ owner: ownerId });
    
    if (!restaurant) {
      throw new AppError('Restaurant not found', 404);
    }
    
    const order = await Order.findOne({ _id: orderId, restaurant: restaurant._id });
    
    if (!order) {
      throw new AppError('Order not found', 404);
    }
    
    order.orderStatus = status;
    if (note) {
      order.statusHistory[order.statusHistory.length - 1].note = note;
    }
    await order.save();
    
    // Emit socket event
    if (io) {
      io.to(`order-${orderId}`).emit('order-status-updated', {
        orderId: order._id,
        orderNumber: order.orderNumber,
        status: order.orderStatus,
        timestamp: new Date()
      });
      
      io.to(`restaurant-${restaurant._id}`).emit('order-updated', {
        orderId: order._id,
        orderNumber: order.orderNumber,
        status: order.orderStatus
      });
    }
    
    return order;
  }
  
  /**
   * Set estimated time for order
   */
  async setEstimatedTime(ownerId, orderId, estimatedTime, io) {
    const restaurant = await Restaurant.findOne({ owner: ownerId });
    
    if (!restaurant) {
      throw new AppError('Restaurant not found', 404);
    }
    
    const order = await Order.findOne({ _id: orderId, restaurant: restaurant._id });
    
    if (!order) {
      throw new AppError('Order not found', 404);
    }
    
    order.estimatedTime = estimatedTime;
    await order.save();
    
    // Emit socket event
    if (io) {
      io.to(`order-${orderId}`).emit('order-time-updated', {
        orderId: order._id,
        orderNumber: order.orderNumber,
        estimatedTime: order.estimatedTime,
        timestamp: new Date()
      });
    }
    
    return order;
  }
  
  /**
   * Update payment status
   */
  async updatePaymentStatus(ownerId, orderId, paymentStatus, io) {
    const restaurant = await Restaurant.findOne({ owner: ownerId });
    
    if (!restaurant) {
      throw new AppError('Restaurant not found', 404);
    }
    
    const order = await Order.findOne({ _id: orderId, restaurant: restaurant._id });
    
    if (!order) {
      throw new AppError('Order not found', 404);
    }
    
    order.paymentStatus = paymentStatus;
    
    // If marking as completed, add payment time
    if (paymentStatus === 'completed' && !order.paymentDetails) {
      order.paymentDetails = {
        paymentTime: new Date()
      };
    }
    
    await order.save();
    
    // Emit socket event
    if (io) {
      io.to(`order-${orderId}`).emit('payment-status-updated', {
        orderId: order._id,
        orderNumber: order.orderNumber,
        paymentStatus: order.paymentStatus,
        timestamp: new Date()
      });
      
      io.to(`restaurant-${restaurant._id}`).emit('payment-updated', {
        orderId: order._id,
        orderNumber: order.orderNumber,
        paymentStatus: order.paymentStatus
      });
    }
    
    return order;
  }
  
  /**
   * Get order statistics
   */
  async getOrderStats(ownerId) {
    const restaurant = await Restaurant.findOne({ owner: ownerId });
    
    if (!restaurant) {
      throw new AppError('Restaurant not found', 404);
    }
    
    const totalOrders = await Order.countDocuments({ restaurant: restaurant._id });
    const pendingOrders = await Order.countDocuments({ 
      restaurant: restaurant._id, 
      orderStatus: { $in: ['pending', 'confirmed', 'preparing'] } 
    });
    const completedOrders = await Order.countDocuments({ 
      restaurant: restaurant._id, 
      orderStatus: 'completed' 
    });
    
    const revenueResult = await Order.aggregate([
      { $match: { restaurant: restaurant._id, paymentStatus: 'completed' } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);
    
    const totalRevenue = revenueResult.length > 0 ? revenueResult[0].total : 0;
    
    return {
      totalOrders,
      pendingOrders,
      completedOrders,
      totalRevenue
    };
  }
}

export default new OrderService();
