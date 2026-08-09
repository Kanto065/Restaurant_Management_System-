import express from 'express';
import orderController from './order.controller.js';
import { protect } from '../../middlewares/auth.js';
import validate from '../../middlewares/validate.js';
import { 
  updateOrderStatusSchema, 
  updateEstimatedTimeSchema,
  updatePaymentStatusSchema 
} from '../../validators/order.validator.js';

const router = express.Router();

/**
 * @swagger
 * /api/orders/stats:
 *   get:
 *     summary: Get order statistics
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Statistics fetched successfully
 */
router.get('/stats', protect, orderController.getOrderStats);

/**
 * @swagger
 * /api/orders:
 *   get:
 *     summary: Get all orders
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, confirmed, preparing, ready, served, completed, cancelled]
 *       - in: query
 *         name: paymentStatus
 *         schema:
 *           type: string
 *           enum: [pending, completed, failed, refunded]
 *       - in: query
 *         name: paymentMethod
 *         schema:
 *           type: string
 *           enum: [cash, online]
 *     responses:
 *       200:
 *         description: Orders fetched successfully
 */
router.get('/', protect, orderController.getAllOrders);

/**
 * @swagger
 * /api/orders/{id}:
 *   get:
 *     summary: Get order by ID
 *     tags: [Orders]
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
 *         description: Order fetched successfully
 *       404:
 *         description: Order not found
 */
router.get('/:id', protect, orderController.getOrderById);

/**
 * @swagger
 * /api/orders/{id}/status:
 *   put:
 *     summary: Update order status
 *     tags: [Orders]
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
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [pending, confirmed, preparing, ready, served, completed, cancelled]
 *               note:
 *                 type: string
 *     responses:
 *       200:
 *         description: Order status updated successfully
 */
router.put('/:id/status', protect, validate(updateOrderStatusSchema), orderController.updateOrderStatus);

/**
 * @swagger
 * /api/orders/{id}/estimated-time:
 *   put:
 *     summary: Set estimated time for order
 *     tags: [Orders]
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
 *               - estimatedTime
 *             properties:
 *               estimatedTime:
 *                 type: number
 *                 description: Estimated time in minutes
 *     responses:
 *       200:
 *         description: Estimated time set successfully
 */
router.put('/:id/estimated-time', protect, validate(updateEstimatedTimeSchema), orderController.setEstimatedTime);

/**
 * @swagger
 * /api/orders/{id}/payment-status:
 *   put:
 *     summary: Update payment status (for cash payments)
 *     tags: [Orders]
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
 *               - paymentStatus
 *             properties:
 *               paymentStatus:
 *                 type: string
 *                 enum: [pending, completed, failed, refunded]
 *                 description: Payment status
 *     responses:
 *       200:
 *         description: Payment status updated successfully
 */
router.put('/:id/payment-status', protect, validate(updatePaymentStatusSchema), orderController.updatePaymentStatus);

export default router;
