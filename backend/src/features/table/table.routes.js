import express from 'express';
import tableController from './table.controller.js';
import { protect } from '../../middlewares/auth.js';
import validate from '../../middlewares/validate.js';
import { createTableSchema, updateTableSchema } from '../../validators/table.validator.js';

const router = express.Router();

/**
 * @swagger
 * /api/tables:
 *   get:
 *     summary: Get all tables
 *     tags: [Tables]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Tables fetched successfully
 */
router.get('/', protect, tableController.getAllTables);

/**
 * @swagger
 * /api/tables/{id}:
 *   get:
 *     summary: Get table by ID
 *     tags: [Tables]
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
 *         description: Table fetched successfully
 *       404:
 *         description: Table not found
 */
router.get('/:id', protect, tableController.getTableById);

/**
 * @swagger
 * /api/tables:
 *   post:
 *     summary: Create new table
 *     tags: [Tables]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tableNumber
 *             properties:
 *               tableNumber:
 *                 type: string
 *               capacity:
 *                 type: number
 *                 minimum: 1
 *                 default: 4
 *               location:
 *                 type: string
 *     responses:
 *       201:
 *         description: Table created successfully
 */
router.post('/', protect, validate(createTableSchema), tableController.createTable);

/**
 * @swagger
 * /api/tables/{id}:
 *   put:
 *     summary: Update table
 *     tags: [Tables]
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
 *               tableNumber:
 *                 type: string
 *               capacity:
 *                 type: number
 *               location:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Table updated successfully
 */
router.put('/:id', protect, validate(updateTableSchema), tableController.updateTable);

/**
 * @swagger
 * /api/tables/{id}:
 *   delete:
 *     summary: Delete table
 *     tags: [Tables]
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
 *         description: Table deleted successfully
 */
router.delete('/:id', protect, tableController.deleteTable);

export default router;
