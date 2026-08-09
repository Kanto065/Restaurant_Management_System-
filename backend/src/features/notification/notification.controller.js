import asyncHandler from '../../utils/asyncHandler.js';
import ApiResponse from '../../utils/ApiResponse.js';
import notificationService from './notification.service.js';

class NotificationController {
  /**
   * @desc    Get all notifications
   * @route   GET /api/notifications
   * @access  Private
   */
  getNotifications = asyncHandler(async (req, res) => {
    const filters = {
      isRead: req.query.isRead === 'true' ? true : req.query.isRead === 'false' ? false : undefined,
      type: req.query.type,
      limit: parseInt(req.query.limit) || 50
    };
    
    const notifications = await notificationService.getNotifications(req.owner._id, filters);
    
    res.status(200).json(
      new ApiResponse(200, { notifications, count: notifications.length }, 'Notifications fetched successfully')
    );
  });

  /**
   * @desc    Get unread notification count
   * @route   GET /api/notifications/unread-count
   * @access  Private
   */
  getUnreadCount = asyncHandler(async (req, res) => {
    const count = await notificationService.getUnreadCount(req.owner._id);
    
    res.status(200).json(
      new ApiResponse(200, { unreadCount: count }, 'Unread count fetched successfully')
    );
  });

  /**
   * @desc    Mark notification as read
   * @route   PUT /api/notifications/:id/read
   * @access  Private
   */
  markAsRead = asyncHandler(async (req, res) => {
    const notification = await notificationService.markAsRead(req.owner._id, req.params.id);
    
    res.status(200).json(
      new ApiResponse(200, { notification }, 'Notification marked as read')
    );
  });

  /**
   * @desc    Mark all notifications as read
   * @route   PUT /api/notifications/mark-all-read
   * @access  Private
   */
  markAllAsRead = asyncHandler(async (req, res) => {
    const result = await notificationService.markAllAsRead(req.owner._id);
    
    res.status(200).json(
      new ApiResponse(200, { updatedCount: result.modifiedCount }, 'All notifications marked as read')
    );
  });

  /**
   * @desc    Delete old notifications
   * @route   DELETE /api/notifications/old
   * @access  Private
   */
  deleteOldNotifications = asyncHandler(async (req, res) => {
    const daysOld = parseInt(req.query.days) || 30;
    const result = await notificationService.deleteOldNotifications(req.owner._id, daysOld);
    
    res.status(200).json(
      new ApiResponse(200, { deletedCount: result.deletedCount }, `Notifications older than ${daysOld} days deleted`)
    );
  });
}

export default new NotificationController();
