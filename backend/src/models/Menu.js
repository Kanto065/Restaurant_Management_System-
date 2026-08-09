import mongoose from 'mongoose';

const menuSchema = new mongoose.Schema({
  restaurant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Restaurant',
    required: true
  },
  name: {
    type: String,
    required: [true, 'Menu name is required'],
    trim: true,
    maxlength: [100, 'Menu name cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  foods: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Food'
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  displayOrder: {
    type: Number,
    default: 0
  },
  availableFrom: {
    type: String, // e.g., "09:00"
    default: null
  },
  availableTo: {
    type: String, // e.g., "22:00"
    default: null
  },
  availableDays: {
    type: [String],
    enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
    default: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
  }
}, {
  timestamps: true
});

// Index for faster queries
menuSchema.index({ restaurant: 1, isActive: 1 });
menuSchema.index({ restaurant: 1, displayOrder: 1 });

const Menu = mongoose.model('Menu', menuSchema);

export default Menu;
