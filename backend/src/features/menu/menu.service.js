import Menu from '../../models/Menu.js';
import Restaurant from '../../models/Restaurant.js';
import Food from '../../models/Food.js';
import AppError from '../../utils/AppError.js';

class MenuService {
  /**
   * Create a new menu
   */
  async createMenu(ownerId, menuData) {
    const restaurant = await Restaurant.findOne({ owner: ownerId });
    
    if (!restaurant) {
      throw new AppError('Restaurant not found', 404);
    }

    // Validate foods if provided
    if (menuData.foods && menuData.foods.length > 0) {
      const foods = await Food.find({
        _id: { $in: menuData.foods },
        restaurant: restaurant._id,
        isAvailable: true
      });

      if (foods.length !== menuData.foods.length) {
        throw new AppError('Some foods are not found or unavailable', 400);
      }
    }

    const menu = await Menu.create({
      restaurant: restaurant._id,
      ...menuData
    });

    await menu.populate('foods', 'name price category image isAvailable isBadge');

    return menu;
  }

  /**
   * Get all menus
   */
  async getAllMenus(ownerId, filters = {}) {
    const restaurant = await Restaurant.findOne({ owner: ownerId });
    
    if (!restaurant) {
      throw new AppError('Restaurant not found', 404);
    }

    const query = { restaurant: restaurant._id };

    // Apply filters
    if (filters.isActive !== undefined) {
      query.isActive = filters.isActive;
    }

    const menus = await Menu.find(query)
      .populate('foods', 'name price category image isAvailable isBadge')
      .sort({ displayOrder: 1, createdAt: -1 });

    return menus;
  }

  /**
   * Get menu by ID
   */
  async getMenuById(ownerId, menuId) {
    const restaurant = await Restaurant.findOne({ owner: ownerId });
    
    if (!restaurant) {
      throw new AppError('Restaurant not found', 404);
    }

    const menu = await Menu.findOne({ _id: menuId, restaurant: restaurant._id })
      .populate('foods', 'name price category image isAvailable isBadge preparationTime spiceLevel');

    if (!menu) {
      throw new AppError('Menu not found', 404);
    }

    return menu;
  }

  /**
   * Update menu
   */
  async updateMenu(ownerId, menuId, updateData) {
    const restaurant = await Restaurant.findOne({ owner: ownerId });
    
    if (!restaurant) {
      throw new AppError('Restaurant not found', 404);
    }

    // Validate foods if being updated
    if (updateData.foods && updateData.foods.length > 0) {
      const foods = await Food.find({
        _id: { $in: updateData.foods },
        restaurant: restaurant._id
      });

      if (foods.length !== updateData.foods.length) {
        throw new AppError('Some foods are not found', 400);
      }
    }

    const menu = await Menu.findOneAndUpdate(
      { _id: menuId, restaurant: restaurant._id },
      updateData,
      { new: true, runValidators: true }
    ).populate('foods', 'name price category image isAvailable isBadge');

    if (!menu) {
      throw new AppError('Menu not found', 404);
    }

    return menu;
  }

  /**
   * Delete menu
   */
  async deleteMenu(ownerId, menuId) {
    const restaurant = await Restaurant.findOne({ owner: ownerId });
    
    if (!restaurant) {
      throw new AppError('Restaurant not found', 404);
    }

    const menu = await Menu.findOneAndDelete({
      _id: menuId,
      restaurant: restaurant._id
    });

    if (!menu) {
      throw new AppError('Menu not found', 404);
    }

    return menu;
  }

  /**
   * Add foods to menu
   */
  async addFoodsToMenu(ownerId, menuId, foodIds) {
    const restaurant = await Restaurant.findOne({ owner: ownerId });
    
    if (!restaurant) {
      throw new AppError('Restaurant not found', 404);
    }

    const menu = await Menu.findOne({ _id: menuId, restaurant: restaurant._id });

    if (!menu) {
      throw new AppError('Menu not found', 404);
    }

    // Validate foods
    const foods = await Food.find({
      _id: { $in: foodIds },
      restaurant: restaurant._id
    });

    if (foods.length !== foodIds.length) {
      throw new AppError('Some foods are not found', 400);
    }

    // Add only new foods (avoid duplicates)
    const newFoodIds = foodIds.filter(id => !menu.foods.includes(id));
    
    if (newFoodIds.length === 0) {
      throw new AppError('All foods are already in the menu', 400);
    }

    menu.foods.push(...newFoodIds);
    await menu.save();

    await menu.populate('foods', 'name price category image isAvailable isBadge');

    return menu;
  }

  /**
   * Remove foods from menu
   */
  async removeFoodsFromMenu(ownerId, menuId, foodIds) {
    const restaurant = await Restaurant.findOne({ owner: ownerId });
    
    if (!restaurant) {
      throw new AppError('Restaurant not found', 404);
    }

    const menu = await Menu.findOne({ _id: menuId, restaurant: restaurant._id });

    if (!menu) {
      throw new AppError('Menu not found', 404);
    }

    menu.foods = menu.foods.filter(foodId => !foodIds.includes(foodId.toString()));
    await menu.save();

    await menu.populate('foods', 'name price category image isAvailable isBadge');

    return menu;
  }

  /**
   * Reorder foods in menu
   */
  async reorderFoods(ownerId, menuId, orderedFoodIds) {
    const restaurant = await Restaurant.findOne({ owner: ownerId });
    
    if (!restaurant) {
      throw new AppError('Restaurant not found', 404);
    }

    const menu = await Menu.findOne({ _id: menuId, restaurant: restaurant._id });

    if (!menu) {
      throw new AppError('Menu not found', 404);
    }

    // Validate that all food IDs in the order exist in the menu
    const menuFoodIds = menu.foods.map(id => id.toString());
    const allValid = orderedFoodIds.every(id => menuFoodIds.includes(id));

    if (!allValid || orderedFoodIds.length !== menu.foods.length) {
      throw new AppError('Invalid food order provided', 400);
    }

    menu.foods = orderedFoodIds;
    await menu.save();

    await menu.populate('foods', 'name price category image isAvailable isBadge');

    return menu;
  }

  /**
   * Update menu display order
   */
  async updateMenuOrder(ownerId, menuOrders) {
    const restaurant = await Restaurant.findOne({ owner: ownerId });
    
    if (!restaurant) {
      throw new AppError('Restaurant not found', 404);
    }

    // Update display order for each menu
    const updatePromises = menuOrders.map(({ menuId, displayOrder }) =>
      Menu.findOneAndUpdate(
        { _id: menuId, restaurant: restaurant._id },
        { displayOrder },
        { new: true }
      )
    );

    await Promise.all(updatePromises);

    return { message: 'Menu order updated successfully' };
  }
}

export default new MenuService();
