import path from 'path';
import fs from 'fs';
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

class RestaurantService {
  async getRestaurant(ownerId) {
    const restaurant = await Restaurant.findOne({ owner: ownerId });
    if (!restaurant) throw new AppError('Restaurant not found', 404);
    return restaurant;
  }

  async updateRestaurant(ownerId, updateData) {
    let restaurant = await Restaurant.findOne({ owner: ownerId });
    if (!restaurant) {
      restaurant = await Restaurant.create({ owner: ownerId, ...updateData });
    } else {
      Object.assign(restaurant, updateData);
      await restaurant.save();
    }
    return restaurant;
  }

  async uploadLogo(ownerId, file) {
    if (!file) throw new AppError('No file uploaded', 400);

    const restaurant = await Restaurant.findOne({ owner: ownerId });
    if (!restaurant) throw new AppError('Restaurant not found', 404);

    deleteLocalFile(restaurant.logo);

    restaurant.logo = `/uploads/${file.filename}`;
    await restaurant.save();

    return { logo: restaurant.logo, logoUrl: restaurant.logo };
  }

  async deleteLogo(ownerId) {
    const restaurant = await Restaurant.findOne({ owner: ownerId });
    if (!restaurant) throw new AppError('Restaurant not found', 404);

    deleteLocalFile(restaurant.logo);
    restaurant.logo = null;
    await restaurant.save();

    return { message: 'Logo deleted successfully' };
  }
}

export default new RestaurantService();
