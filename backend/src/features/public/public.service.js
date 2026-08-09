import Table from '../../models/Table.js';
import Restaurant from '../../models/Restaurant.js';
import Food from '../../models/Food.js';
import Order from '../../models/Order.js';
import Notification from '../../models/Notification.js';
import Menu from '../../models/Menu.js';
import AppError from '../../utils/AppError.js';

class PublicService {
  /**
   * Get table details with restaurant and menu
   */
  async getTableDetails(tableUrl) {
    const table = await Table.findOne({ uniqueUrl: tableUrl, isActive: true })
      .populate('restaurant');
    
    if (!table) {
      throw new AppError('Table not found or inactive', 404);
    }
    
    if (!table.restaurant.isActive) {
      throw new AppError('Restaurant is currently closed', 403);
    }
    
    // Get available foods
    const foods = await Food.find({ 
      restaurant: table.restaurant._id,
      isAvailable: true 
    }).sort({ category: 1, name: 1 });
    
    return {
      table: {
        tableNumber: table.tableNumber,
        location: table.location,
        capacity: table.capacity
      },
      restaurant: {
        name: table.restaurant.name,
        description: table.restaurant.description,
        logo: table.restaurant.logo,
        phone: table.restaurant.phone,
        email: table.restaurant.email,
        address: table.restaurant.address,
        openingHours: table.restaurant.openingHours
      },
      foods
    };
  }
  
  /**
   * Place order
   */
  async placeOrder(orderData, io) {
    let { tableUrl, items, customerName, customerPhone, customerEmail, paymentMethod, specialRequests } = orderData;
    
    // Extract UUID from full URL if provided
    // e.g., "http://localhost:7878/api/public/table/UUID" -> "UUID"
    if (tableUrl.includes('/')) {
      const parts = tableUrl.split('/');
      tableUrl = parts[parts.length - 1];
    }
    
    // Find table
    const table = await Table.findOne({ uniqueUrl: tableUrl, isActive: true })
      .populate('restaurant');
    
    if (!table) {
      throw new AppError('Table not found or inactive', 404);
    }
    
    if (!table.restaurant.isActive) {
      throw new AppError('Restaurant is currently closed', 403);
    }
    
    // Validate and calculate order items
    let totalAmount = 0;
    const orderItems = [];
    
    for (const item of items) {
      // Try to find food by ID first, then by name
      let food;
      
      // Check if it's a valid ObjectId format
      if (item.food.match(/^[0-9a-fA-F]{24}$/)) {
        food = await Food.findOne({ 
          _id: item.food,
          restaurant: table.restaurant._id,
          isAvailable: true
        });
      }
      
      // If not found by ID or not a valid ID format, try by name
      if (!food) {
        food = await Food.findOne({ 
          name: { $regex: new RegExp(`^${item.food}$`, 'i') }, // Case-insensitive exact match
          restaurant: table.restaurant._id,
          isAvailable: true
        });
      }
      
      if (!food) {
        throw new AppError(`Food item "${item.food}" not found or unavailable`, 404);
      }
      
      const itemTotal = food.price * item.quantity;
      totalAmount += itemTotal;
      
      orderItems.push({
        food: food._id,
        name: food.name,
        price: food.price,
        quantity: item.quantity,
        specialInstructions: item.specialInstructions || ''
      });
    }
    
    // Create order
    const order = await Order.create({
      restaurant: table.restaurant._id,
      table: table._id,
      items: orderItems,
      totalAmount,
      customerName,
      customerPhone,
      customerEmail,
      paymentMethod,
      specialRequests,
      paymentStatus: paymentMethod === 'cash' ? 'pending' : 'pending',
      orderStatus: 'pending'
    });
    
    // Populate order for response
    await order.populate('table', 'tableNumber location');
    await order.populate('items.food', 'name category image');
    
    // Create notification record
    await Notification.create({
      restaurant: table.restaurant._id,
      type: 'new_order',
      title: 'New Order Received',
      message: `New order #${order.orderNumber} from ${table.tableNumber}`,
      order: order._id,
      data: {
        orderNumber: order.orderNumber,
        tableNumber: table.tableNumber,
        customerName: order.customerName,
        totalAmount: order.totalAmount,
        itemCount: orderItems.length
      }
    });
    
    // Emit socket event to restaurant for notification
    if (io) {
      io.to(`restaurant-${table.restaurant._id}`).emit('new-order-notification', {
        orderId: order._id,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        table: {
          tableNumber: table.tableNumber,
          location: table.location
        },
        items: orderItems.map(item => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price
        })),
        totalAmount: order.totalAmount,
        paymentMethod: order.paymentMethod,
        orderStatus: order.orderStatus,
        timestamp: new Date(),
        message: `New order received from ${table.tableNumber}!`
      });
      
      // Also emit the existing order-created event for backward compatibility
      io.to(`restaurant-${table.restaurant._id}`).emit('order-created', {
        orderId: order._id,
        orderNumber: order.orderNumber,
        tableNumber: table.tableNumber,
        totalAmount: order.totalAmount,
        paymentMethod: order.paymentMethod,
        timestamp: new Date()
      });
    }
    
    return { order };
  }
  
  /**
   * Get order status (for customer tracking)
   */
  async getOrderStatus(orderNumber) {
    const order = await Order.findOne({ orderNumber })
      .populate('table', 'tableNumber')
      .populate('restaurant', 'name logo')
      .select('-paymentDetails');
    
    if (!order) {
      throw new AppError('Order not found', 404);
    }
    
    return order;
  }

  /**
   * Get customer orders by mobile number
   */
  async getOrdersByPhone(customerPhone) {
    if (!customerPhone) {
      throw new AppError('Mobile number is required', 400);
    }

    // Find all orders for this customer
    const orders = await Order.find({ customerPhone })
      .populate('restaurant', 'name logo phone address')
      .populate('table', 'tableNumber location')
      .populate('items.food', 'name category image')
      .sort({ createdAt: -1 }) // Most recent first
      .select('-paymentDetails'); // Exclude sensitive payment details
    
    if (!orders || orders.length === 0) {
      throw new AppError('No orders found for this mobile number', 404);
    }

    // Separate active and completed orders
    const activeStatuses = ['pending', 'confirmed', 'preparing', 'ready', 'served'];
    const activeOrders = orders.filter(order => activeStatuses.includes(order.orderStatus));
    const completedOrders = orders.filter(order => !activeStatuses.includes(order.orderStatus));

    // Combine with active orders first
    const sortedOrders = [...activeOrders, ...completedOrders];

    return {
      totalOrders: sortedOrders.length,
      activeOrders: activeOrders.length,
      orders: sortedOrders
    };
  }

  /**
   * Get all active menus for a restaurant (public view)
   */
  async getRestaurantMenus(tableUrl) {
    // Get table to find restaurant
    const table = await Table.findOne({ uniqueUrl: tableUrl, isActive: true })
      .populate('restaurant');
    
    if (!table) {
      throw new AppError('Table not found or inactive', 404);
    }
    
    if (!table.restaurant.isActive) {
      throw new AppError('Restaurant is currently closed', 403);
    }

    // Get all active menus with available foods
    const menus = await Menu.find({
      restaurant: table.restaurant._id,
      isActive: true
    })
      .populate({
        path: 'foods',
        match: { isAvailable: true },
        select: 'name description price image category isAvailable isBadge'
      })
      .sort({ displayOrder: 1 })
      .select('-restaurant -__v');

    // Get current day and time (using UTC+6 for Bangladesh timezone)
    const now = new Date();
    // Adjust to Bangladesh timezone (UTC+6)
    const bangladeshTime = new Date(now.getTime() + (6 * 60 * 60 * 1000));
    const currentDay = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][bangladeshTime.getUTCDay()];
    const currentHour = bangladeshTime.getUTCHours();
    const currentMinute = bangladeshTime.getUTCMinutes();
    const currentTimeMinutes = currentHour * 60 + currentMinute;

    // Filter menus by availability schedule
    const availableMenus = menus.filter(menu => {
      // Check if today is in available days
      if (!menu.availableDays.includes(currentDay)) {
        return false;
      }

      // Check time range if specified
      if (menu.availableFrom && menu.availableTo) {
        // Convert time strings to minutes for comparison
        const [fromHour, fromMin] = menu.availableFrom.split(':').map(Number);
        const [toHour, toMin] = menu.availableTo.split(':').map(Number);
        const fromMinutes = fromHour * 60 + fromMin;
        const toMinutes = toHour * 60 + toMin;

        // Check if current time is within range
        if (currentTimeMinutes < fromMinutes || currentTimeMinutes > toMinutes) {
          return false;
        }
      }

      return true;
    });

    return {
      restaurant: {
        name: table.restaurant.name,
        description: table.restaurant.description,
        logo: table.restaurant.logo
      },
      menus: availableMenus,
      count: availableMenus.length
    };
  }

  /**
   * Get a specific menu with all its foods (public view)
   */
  async getMenuDetails(tableUrl, menuId) {
    // Get table to find restaurant
    const table = await Table.findOne({ uniqueUrl: tableUrl, isActive: true })
      .populate('restaurant');
    
    if (!table) {
      throw new AppError('Table not found or inactive', 404);
    }
    
    if (!table.restaurant.isActive) {
      throw new AppError('Restaurant is currently closed', 403);
    }

    // Get the menu
    const menu = await Menu.findOne({
      _id: menuId,
      restaurant: table.restaurant._id,
      isActive: true
    })
      .populate({
        path: 'foods',
        match: { isAvailable: true },
        select: 'name description price image category isAvailable isBadge'
      })
      .select('-restaurant -__v');

    if (!menu) {
      throw new AppError('Menu not found or inactive', 404);
    }

    // Check availability schedule (using UTC+6 for Bangladesh timezone)
    const now = new Date();
    // Adjust to Bangladesh timezone (UTC+6)
    const bangladeshTime = new Date(now.getTime() + (6 * 60 * 60 * 1000));
    const currentDay = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][bangladeshTime.getUTCDay()];
    const currentHour = bangladeshTime.getUTCHours();
    const currentMinute = bangladeshTime.getUTCMinutes();
    const currentTimeMinutes = currentHour * 60 + currentMinute;

    // Check if today is in available days
    if (!menu.availableDays.includes(currentDay)) {
      throw new AppError('This menu is not available today', 403);
    }

    // Check time range if specified
    if (menu.availableFrom && menu.availableTo) {
      // Convert time strings to minutes for comparison
      const [fromHour, fromMin] = menu.availableFrom.split(':').map(Number);
      const [toHour, toMin] = menu.availableTo.split(':').map(Number);
      const fromMinutes = fromHour * 60 + fromMin;
      const toMinutes = toHour * 60 + toMin;

      // Check if current time is within range
      if (currentTimeMinutes < fromMinutes || currentTimeMinutes > toMinutes) {
        throw new AppError(`This menu is only available from ${menu.availableFrom} to ${menu.availableTo}`, 403);
      }
    }

    return {
      menu,
      restaurant: {
        name: table.restaurant.name,
        logo: table.restaurant.logo
      }
    };
  }
}

export default new PublicService();
