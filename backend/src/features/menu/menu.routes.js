import express from 'express';
import menuController from './menu.controller.js';
import { protect } from '../../middlewares/auth.js';
import validate from '../../middlewares/validate.js';
import {
  createMenuSchema,
  updateMenuSchema,
  addFoodsSchema,
  removeFoodsSchema,
  reorderFoodsSchema,
  updateMenuOrderSchema
} from '../../validators/menu.validator.js';

const router = express.Router();

/**
 * @swagger
 * /api/menus:
 *   post:
 *     summary: Create a new menu
 *     tags: [Menus]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Breakfast Menu"
 *               description:
 *                 type: string
 *               foods:
 *                 type: array
 *                 items:
 *                   type: string
 *               isActive:
 *                 type: boolean
 *               displayOrder:
 *                 type: number
 *               availableFrom:
 *                 type: string
 *                 example: "06:00"
 *               availableTo:
 *                 type: string
 *                 example: "11:00"
 *               availableDays:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Menu created successfully
 */
router.post('/', protect, validate(createMenuSchema), menuController.createMenu);

/**
 * @swagger
 * /api/menus:
 *   get:
 *     summary: Get all menus
 *     tags: [Menus]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Menus fetched successfully
 */
router.get('/', protect, menuController.getAllMenus);

/**
 * @swagger
 * /api/menus/update-order:
 *   put:
 *     summary: Update menu display order
 *     tags: [Menus]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - menuOrders
 *             properties:
 *               menuOrders:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     menuId:
 *                       type: string
 *                     displayOrder:
 *                       type: number
 *     responses:
 *       200:
 *         description: Menu order updated successfully
 */
router.put('/update-order', protect, validate(updateMenuOrderSchema), menuController.updateMenuOrder);

/**
 * @swagger
 * /api/menus/{id}:
 *   get:
 *     summary: Get menu by ID
 *     tags: [Menus]
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
 *         description: Menu fetched successfully
 */
router.get('/:id', protect, menuController.getMenuById);

/**
 * @swagger
 * /api/menus/{id}:
 *   put:
 *     summary: Update menu
 *     tags: [Menus]
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
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               foods:
 *                 type: array
 *                 items:
 *                   type: string
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Menu updated successfully
 */
router.put('/:id', protect, validate(updateMenuSchema), menuController.updateMenu);

/**
 * @swagger
 * /api/menus/{id}:
 *   delete:
 *     summary: Delete menu
 *     tags: [Menus]
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
 *         description: Menu deleted successfully
 */
router.delete('/:id', protect, menuController.deleteMenu);

/**
 * @swagger
 * /api/menus/{id}/foods:
 *   post:
 *     summary: Add foods to menu
 *     tags: [Menus]
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
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - foodIds
 *             properties:
 *               foodIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Foods added to menu successfully
 */
router.post('/:id/foods', protect, validate(addFoodsSchema), menuController.addFoodsToMenu);

/**
 * @swagger
 * /api/menus/{id}/foods:
 *   delete:
 *     summary: Remove foods from menu
 *     tags: [Menus]
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
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - foodIds
 *             properties:
 *               foodIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Foods removed from menu successfully
 */
router.delete('/:id/foods', protect, validate(removeFoodsSchema), menuController.removeFoodsFromMenu);

/**
 * @swagger
 * /api/menus/{id}/reorder:
 *   put:
 *     summary: Reorder foods in menu
 *     tags: [Menus]
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
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - foodIds
 *             properties:
 *               foodIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Foods reordered successfully
 */
router.put('/:id/reorder', protect, validate(reorderFoodsSchema), menuController.reorderFoods);

export default router;
