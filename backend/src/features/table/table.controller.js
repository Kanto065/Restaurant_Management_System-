import asyncHandler from '../../utils/asyncHandler.js';
import ApiResponse from '../../utils/ApiResponse.js';
import tableService from './table.service.js';

class TableController {
  /**
   * @desc    Get all tables
   * @route   GET /api/tables
   * @access  Private
   */
  getAllTables = asyncHandler(async (req, res) => {
    const tables = await tableService.getAllTables(req.owner._id);
    
    res.status(200).json(
      new ApiResponse(200, { tables, count: tables.length }, 'Tables fetched successfully')
    );
  });
  
  /**
   * @desc    Get table by ID
   * @route   GET /api/tables/:id
   * @access  Private
   */
  getTableById = asyncHandler(async (req, res) => {
    const table = await tableService.getTableById(req.owner._id, req.params.id);
    
    res.status(200).json(
      new ApiResponse(200, { table }, 'Table fetched successfully')
    );
  });
  
  /**
   * @desc    Create new table
   * @route   POST /api/tables
   * @access  Private
   */
  createTable = asyncHandler(async (req, res) => {
    const table = await tableService.createTable(req.owner._id, req.body);
    
    res.status(201).json(
      new ApiResponse(201, { table }, 'Table created successfully')
    );
  });
  
  /**
   * @desc    Update table
   * @route   PUT /api/tables/:id
   * @access  Private
   */
  updateTable = asyncHandler(async (req, res) => {
    const table = await tableService.updateTable(req.owner._id, req.params.id, req.body);
    
    res.status(200).json(
      new ApiResponse(200, { table }, 'Table updated successfully')
    );
  });
  
  /**
   * @desc    Delete table
   * @route   DELETE /api/tables/:id
   * @access  Private
   */
  deleteTable = asyncHandler(async (req, res) => {
    const result = await tableService.deleteTable(req.owner._id, req.params.id);
    
    res.status(200).json(
      new ApiResponse(200, result, 'Table deleted successfully')
    );
  });
}

export default new TableController();
