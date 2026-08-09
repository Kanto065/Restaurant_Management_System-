import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

const tableSchema = new mongoose.Schema({
  restaurant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Restaurant',
    required: true
  },
  tableNumber: {
    type: String,
    required: [true, 'Table number is required'],
    trim: true
  },
  capacity: {
    type: Number,
    default: 4,
    min: [1, 'Capacity must be at least 1']
  },
  uniqueUrl: {
    type: String,
    default: function() {
      return uuidv4();
    }
  },
  qrCode: {
    type: String, // URL or path to QR code image (optional for future enhancement)
    default: null
  },
  location: {
    type: String, // e.g., "Ground Floor", "Terrace", "Window Side"
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for full URL
tableSchema.virtual('fullUrl').get(function() {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8081';
  return `${frontendUrl}/${this.uniqueUrl}`;
});

// Indexes for faster queries
tableSchema.index({ restaurant: 1, isActive: 1 });
tableSchema.index({ uniqueUrl: 1 }, { unique: true });
tableSchema.index({ restaurant: 1, tableNumber: 1 }, { unique: true });

const Table = mongoose.model('Table', tableSchema);

export default Table;
