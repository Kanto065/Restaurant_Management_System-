import Table from '../../models/Table.js';
import Restaurant from '../../models/Restaurant.js';
import AppError from '../../utils/AppError.js';
import config from '../../config/config.js';

class TableService {
  /**
   * Get all tables
   */
  async getAllTables(ownerId) {
    const restaurant = await Restaurant.findOne({ owner: ownerId });
    
    if (!restaurant) {
      throw new AppError('Restaurant not found', 404);
    }
    
    const tables = await Table.find({ restaurant: restaurant._id }).sort({ tableNumber: 1 });
    
    // Add full URL to each table
    const tablesWithUrls = tables.map(table => ({
      ...table.toObject(),
      fullUrl: `${config.frontendUrl}/${table.uniqueUrl}`
    }));
    
    return tablesWithUrls;
  }
  
  /**
   * Get table by ID
   */
  async getTableById(ownerId, tableId) {
    const restaurant = await Restaurant.findOne({ owner: ownerId });
    
    if (!restaurant) {
      throw new AppError('Restaurant not found', 404);
    }
    
    const table = await Table.findOne({ _id: tableId, restaurant: restaurant._id });
    
    if (!table) {
      throw new AppError('Table not found', 404);
    }
    
    return {
      ...table.toObject(),
      fullUrl: `${config.frontendUrl}/${table.uniqueUrl}`
    };
  }
  
  /**
   * Create new table
   */
  async createTable(ownerId, tableData) {
    const restaurant = await Restaurant.findOne({ owner: ownerId });
    
    if (!restaurant) {
      throw new AppError('Restaurant not found', 404);
    }
    
    const table = await Table.create({
      ...tableData,
      restaurant: restaurant._id
    });
    
    return {
      ...table.toObject(),
      fullUrl: `${config.frontendUrl}/${table.uniqueUrl}`
    };
  }
  
  /**
   * Update table
   */
  async updateTable(ownerId, tableId, updateData) {
    const restaurant = await Restaurant.findOne({ owner: ownerId });
    
    if (!restaurant) {
      throw new AppError('Restaurant not found', 404);
    }
    
    const table = await Table.findOne({ _id: tableId, restaurant: restaurant._id });
    
    if (!table) {
      throw new AppError('Table not found', 404);
    }
    
    Object.assign(table, updateData);
    await table.save();
    
    return {
      ...table.toObject(),
      fullUrl: `${config.frontendUrl}/${table.uniqueUrl}`
    };
  }
  
  /**
   * Delete table
   */
  async deleteTable(ownerId, tableId) {
    const restaurant = await Restaurant.findOne({ owner: ownerId });
    
    if (!restaurant) {
      throw new AppError('Restaurant not found', 404);
    }
    
    const table = await Table.findOne({ _id: tableId, restaurant: restaurant._id });
    
    if (!table) {
      throw new AppError('Table not found', 404);
    }
    
    await table.deleteOne();
    
    return { message: 'Table deleted successfully' };
  }
}

export default new TableService();
