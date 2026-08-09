import asyncHandler from '../../utils/asyncHandler.js';
import ApiResponse from '../../utils/ApiResponse.js';
import foodService from './food.service.js';

class FoodController {
  /**
   * @desc    Get all foods
   * @route   GET /api/foods
   * @access  Private
   */
  getAllFoods = asyncHandler(async (req, res) => {
    const filters = {
      category: req.query.category,
      isAvailable: req.query.isAvailable === 'true' ? true : req.query.isAvailable === 'false' ? false : undefined,
      isVegetarian: req.query.isVegetarian === 'true' ? true : req.query.isVegetarian === 'false' ? false : undefined,
      isBadge: req.query.isBadge === 'true' ? true : req.query.isBadge === 'false' ? false : undefined
    };
    
    const foods = await foodService.getAllFoods(req.owner._id, filters);
    
    res.status(200).json(
      new ApiResponse(200, { foods, count: foods.length }, 'Foods fetched successfully')
    );
  });
  
  /**
   * @desc    Get food by ID
   * @route   GET /api/foods/:id
   * @access  Private
   */
  getFoodById = asyncHandler(async (req, res) => {
    const food = await foodService.getFoodById(req.owner._id, req.params.id);
    
    res.status(200).json(
      new ApiResponse(200, { food }, 'Food fetched successfully')
    );
  });
  
  /**
   * @desc    Create new food
   * @route   POST /api/foods
   * @access  Private
   */
  createFood = asyncHandler(async (req, res) => {
    const food = await foodService.createFood(req.owner._id, req.body, req.file);
    
    res.status(201).json(
      new ApiResponse(201, { food }, 'Food created successfully')
    );
  });
  
  /**
   * @desc    Update food
   * @route   PUT /api/foods/:id
   * @access  Private
   */
  updateFood = asyncHandler(async (req, res) => {
    const food = await foodService.updateFood(req.owner._id, req.params.id, req.body, req.file);
    
    res.status(200).json(
      new ApiResponse(200, { food }, 'Food updated successfully')
    );
  });
  
  /**
   * @desc    Delete food
   * @route   DELETE /api/foods/:id
   * @access  Private
   */
  deleteFood = asyncHandler(async (req, res) => {
    const result = await foodService.deleteFood(req.owner._id, req.params.id);
    
    res.status(200).json(
      new ApiResponse(200, result, 'Food deleted successfully')
    );
  });
}

export default new FoodController();
