import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  restaurant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Restaurant',
    required: true
  },
  type: {
    type: String,
    enum: ['new_order', 'payment_completed', 'order_cancelled', 'order_completed'],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Index for faster queries
notificationSchema.index({ restaurant: 1, createdAt: -1 });
notificationSchema.index({ restaurant: 1, isRead: 1 });

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;
