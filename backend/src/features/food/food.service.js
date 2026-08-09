import path from 'path';
import fs from 'fs';
import Food from '../../models/Food.js';
import Restaurant from '../../models/Restaurant.js';
import AppError from '../../utils/AppError.js';
import config from '../../config/config.js';

function deleteLocalFile(storedPath) {
  if (!storedPath) return;
  const filePath = path.join(config.upload.uploadPath, path.basename(storedPath));
  fs.unlink(filePath, (err) => {
    if (err) console.error('Error deleting old file:', err);
  });
}

class FoodService {
  async getAllFoods(ownerId, filters = {}) {
    const restaurant = await Restaurant.findOne({ owner: ownerId });
    if (!restaurant) throw new AppError('Restaurant not found', 404);

    const query = { restaurant: restaurant._id };
    if (filters.category) query.category = filters.category;
    if (filters.isAvailable !== undefined) query.isAvailable = filters.isAvailable;
    if (filters.isVegetarian !== undefined) query.isVegetarian = filters.isVegetarian;
    if (filters.isBadge !== undefined) query.isBadge = filters.isBadge;

    return Food.find(query).sort({ createdAt: -1 });
  }

  async getFoodById(ownerId, foodId) {
    const restaurant = await Restaurant.findOne({ owner: ownerId });
    if (!restaurant) throw new AppError('Restaurant not found', 404);

    const food = await Food.findOne({ _id: foodId, restaurant: restaurant._id });
    if (!food) throw new AppError('Food not found', 404);
    return food;
  }

  async createFood(ownerId, foodData, file) {
    const restaurant = await Restaurant.findOne({ owner: ownerId });
    if (!restaurant) throw new AppError('Restaurant not found', 404);

    return Food.create({
      ...foodData,
      restaurant: restaurant._id,
      image: file ? `/uploads/${file.filename}` : null
    });
  }

  async updateFood(ownerId, foodId, updateData, file) {
    const restaurant = await Restaurant.findOne({ owner: ownerId });
    if (!restaurant) throw new AppError('Restaurant not found', 404);

    const food = await Food.findOne({ _id: foodId, restaurant: restaurant._id });
    if (!food) throw new AppError('Food not found', 404);

    if (file) {
      deleteLocalFile(food.image);
      updateData.image = `/uploads/${file.filename}`;
    }

    Object.assign(food, updateData);
    await food.save();
    return food;
  }

  async deleteFood(ownerId, foodId) {
    const restaurant = await Restaurant.findOne({ owner: ownerId });
    if (!restaurant) throw new AppError('Restaurant not found', 404);

    const food = await Food.findOne({ _id: foodId, restaurant: restaurant._id });
    if (!food) throw new AppError('Food not found', 404);

    deleteLocalFile(food.image);
    await food.deleteOne();

    return { message: 'Food deleted successfully' };
  }
}

export default new FoodService();
