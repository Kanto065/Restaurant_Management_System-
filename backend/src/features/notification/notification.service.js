import Notification from '../../models/Notification.js';
import Restaurant from '../../models/Restaurant.js';
import AppError from '../../utils/AppError.js';

class NotificationService {
  /**
   * Create a notification
   */
  async createNotification(notificationData) {
    const notification = await Notification.create(notificationData);
    return notification;
  }

  /**
   * Get all notifications for a restaurant
   */
  async getNotifications(ownerId, filters = {}) {
    const restaurant = await Restaurant.findOne({ owner: ownerId });
    
    if (!restaurant) {
      throw new AppError('Restaurant not found', 404);
    }
    
    const query = { restaurant: restaurant._id };
    
    // Apply filters
    if (filters.isRead !== undefined) {
      query.isRead = filters.isRead;
    }
    
    if (filters.type) {
      query.type = filters.type;
    }
    
    const notifications = await Notification.find(query)
      .populate('order', 'orderNumber totalAmount customerName')
      .sort({ createdAt: -1 })
      .limit(filters.limit || 50);
    
    return notifications;
  }

  /**
   * Get unread notification count
   */
  async getUnreadCount(ownerId) {
    const restaurant = await Restaurant.findOne({ owner: ownerId });
    
    if (!restaurant) {
      throw new AppError('Restaurant not found', 404);
    }
    
    const count = await Notification.countDocuments({
      restaurant: restaurant._id,
      isRead: false
    });
    
    return count;
  }

  /**
   * Mark notification as read
   */
  async markAsRead(ownerId, notificationId) {
    const restaurant = await Restaurant.findOne({ owner: ownerId });
    
    if (!restaurant) {
      throw new AppError('Restaurant not found', 404);
    }
    
    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, restaurant: restaurant._id },
      { isRead: true, readAt: new Date() },
      { new: true }
    );
    
    if (!notification) {
      throw new AppError('Notification not found', 404);
    }
    
    return notification;
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(ownerId) {
    const restaurant = await Restaurant.findOne({ owner: ownerId });
    
    if (!restaurant) {
      throw new AppError('Restaurant not found', 404);
    }
    
    const result = await Notification.updateMany(
      { restaurant: restaurant._id, isRead: false },
      { isRead: true, readAt: new Date() }
    );
    
    return result;
  }

  /**
   * Delete old notifications
   */
  async deleteOldNotifications(ownerId, daysOld = 30) {
    const restaurant = await Restaurant.findOne({ owner: ownerId });
    
    if (!restaurant) {
      throw new AppError('Restaurant not found', 404);
    }
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    const result = await Notification.deleteMany({
      restaurant: restaurant._id,
      createdAt: { $lt: cutoffDate }
    });
    
    return result;
  }
}

export default new NotificationService();
