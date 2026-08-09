import express from 'express';
import foodController from './food.controller.js';
import { protect } from '../../middlewares/auth.js';
import validate from '../../middlewares/validate.js';
import { createFoodSchema, updateFoodSchema } from '../../validators/food.validator.js';
import upload from '../../utils/fileUpload.js';

const router = express.Router();

// Helper middleware to parse JSON from multipart form data
const parseFormData = (req, res, next) => {
  if (req.body) {
    // Convert string booleans to actual booleans
    if (req.body.isVegetarian !== undefined) {
      req.body.isVegetarian = req.body.isVegetarian === 'true';
    }
    if (req.body.isAvailable !== undefined) {
      req.body.isAvailable = req.body.isAvailable === 'true';
    }
    if (req.body.isBadge !== undefined) {
      req.body.isBadge = req.body.isBadge === 'true';
    }
    // Convert string numbers to actual numbers
    if (req.body.price !== undefined) {
      req.body.price = parseFloat(req.body.price);
    }
    if (req.body.preparationTime !== undefined) {
      req.body.preparationTime = parseInt(req.body.preparationTime);
    }
  }
  next();
};

/**
 * @swagger
 * /api/foods:
 *   get:
 *     summary: Get all foods
 *     tags: [Foods]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [Appetizer, Main Course, Dessert, Beverage, Snack, Other]
 *       - in: query
 *         name: isAvailable
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: isVegetarian
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: isBadge
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Foods fetched successfully
 */
router.get('/', protect, foodController.getAllFoods);

/**
 * @swagger
 * /api/foods/{id}:
 *   get:
 *     summary: Get food by ID
 *     tags: [Foods]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Food fetched successfully
 *       404:
 *         description: Food not found
 */
router.get('/:id', protect, foodController.getFoodById);

/**
 * @swagger
 * /api/foods:
 *   post:
 *     summary: Create new food
 *     tags: [Foods]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - price
 *             properties:
 *               name:
 *                 type: string
 *                 maxLength: 100
 *               description:
 *                 type: string
 *                 maxLength: 500
 *               price:
 *                 type: number
 *                 minimum: 0
 *               category:
 *                 type: string
 *                 enum: [Appetizer, Main Course, Dessert, Beverage, Snack, Other]
 *               isVegetarian:
 *                 type: boolean
 *               isAvailable:
 *                 type: boolean
 *               isBadge:
 *                 type: boolean
 *               preparationTime:
 *                 type: number
 *               spiceLevel:
 *                 type: string
 *                 enum: [None, Mild, Medium, Hot, Extra Hot]
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Food created successfully
 */
router.post('/', protect, upload.single('image'), parseFormData, validate(createFoodSchema), foodController.createFood);

/**
 * @swagger
 * /api/foods/{id}:
 *   put:
 *     summary: Update food
 *     tags: [Foods]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               price:
 *                 type: number
 *               category:
 *                 type: string
 *               isVegetarian:
 *                 type: boolean
 *               isAvailable:
 *                 type: boolean
 *               isBadge:
 *                 type: boolean
 *               preparationTime:
 *                 type: number
 *               spiceLevel:
 *                 type: string
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Food updated successfully
 */
router.put('/:id', protect, upload.single('image'), parseFormData, validate(updateFoodSchema), foodController.updateFood);

/**
 * @swagger
 * /api/foods/{id}:
 *   delete:
 *     summary: Delete food
 *     tags: [Foods]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Food deleted successfully
 */
router.delete('/:id', protect, foodController.deleteFood);

export default router;
