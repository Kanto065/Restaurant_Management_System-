import asyncHandler from '../../utils/asyncHandler.js';
import ApiResponse from '../../utils/ApiResponse.js';
import menuService from './menu.service.js';

class MenuController {
  /**
   * @desc    Create new menu
   * @route   POST /api/menus
   * @access  Private
   */
  createMenu = asyncHandler(async (req, res) => {
    const menu = await menuService.createMenu(req.owner._id, req.body);
    
    res.status(201).json(
      new ApiResponse(201, { menu }, 'Menu created successfully')
    );
  });

  /**
   * @desc    Get all menus
   * @route   GET /api/menus
   * @access  Private
   */
  getAllMenus = asyncHandler(async (req, res) => {
    const filters = {
      isActive: req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined
    };

    const menus = await menuService.getAllMenus(req.owner._id, filters);
    
    res.status(200).json(
      new ApiResponse(200, { menus, count: menus.length }, 'Menus fetched successfully')
    );
  });

  /**
   * @desc    Get menu by ID
   * @route   GET /api/menus/:id
   * @access  Private
   */
  getMenuById = asyncHandler(async (req, res) => {
    const menu = await menuService.getMenuById(req.owner._id, req.params.id);
    
    res.status(200).json(
      new ApiResponse(200, { menu }, 'Menu fetched successfully')
    );
  });

  /**
   * @desc    Update menu
   * @route   PUT /api/menus/:id
   * @access  Private
   */
  updateMenu = asyncHandler(async (req, res) => {
    const menu = await menuService.updateMenu(req.owner._id, req.params.id, req.body);
    
    res.status(200).json(
      new ApiResponse(200, { menu }, 'Menu updated successfully')
    );
  });

  /**
   * @desc    Delete menu
   * @route   DELETE /api/menus/:id
   * @access  Private
   */
  deleteMenu = asyncHandler(async (req, res) => {
    await menuService.deleteMenu(req.owner._id, req.params.id);
    
    res.status(200).json(
      new ApiResponse(200, null, 'Menu deleted successfully')
    );
  });

  /**
   * @desc    Add foods to menu
   * @route   POST /api/menus/:id/foods
   * @access  Private
   */
  addFoodsToMenu = asyncHandler(async (req, res) => {
    const menu = await menuService.addFoodsToMenu(req.owner._id, req.params.id, req.body.foodIds);
    
    res.status(200).json(
      new ApiResponse(200, { menu }, 'Foods added to menu successfully')
    );
  });

  /**
   * @desc    Remove foods from menu
   * @route   DELETE /api/menus/:id/foods
   * @access  Private
   */
  removeFoodsFromMenu = asyncHandler(async (req, res) => {
    const menu = await menuService.removeFoodsFromMenu(req.owner._id, req.params.id, req.body.foodIds);
    
    res.status(200).json(
      new ApiResponse(200, { menu }, 'Foods removed from menu successfully')
    );
  });

  /**
   * @desc    Reorder foods in menu
   * @route   PUT /api/menus/:id/reorder
   * @access  Private
   */
  reorderFoods = asyncHandler(async (req, res) => {
    const menu = await menuService.reorderFoods(req.owner._id, req.params.id, req.body.foodIds);
    
    res.status(200).json(
      new ApiResponse(200, { menu }, 'Foods reordered successfully')
    );
  });

  /**
   * @desc    Update menu display order
   * @route   PUT /api/menus/update-order
   * @access  Private
   */
  updateMenuOrder = asyncHandler(async (req, res) => {
    const result = await menuService.updateMenuOrder(req.owner._id, req.body.menuOrders);
    
    res.status(200).json(
      new ApiResponse(200, result, 'Menu order updated successfully')
    );
  });
}

export default new MenuController();
