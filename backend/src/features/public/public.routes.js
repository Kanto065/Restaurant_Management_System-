import express from 'express';
import publicController from './public.controller.js';
import validate from '../../middlewares/validate.js';
import { createOrderSchema } from '../../validators/order.validator.js';

const router = express.Router();

/**
 * @swagger
 * /api/public/table/{tableUrl}:
 *   get:
 *     summary: Get table details with restaurant info and menu (for customers)
 *     tags: [Public]
 *     parameters:
 *       - in: path
 *         name: tableUrl
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique table URL
 *     responses:
 *       200:
 *         description: Table details with menu
 *       404:
 *         description: Table not found
 */
router.get('/table/:tableUrl', publicController.getTableDetails);

/**
 * @swagger
 * /api/public/orders:
 *   post:
 *     summary: Place order (for customers)
 *     tags: [Public]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tableUrl
 *               - items
 *               - paymentMethod
 *             properties:
 *               tableUrl:
 *                 type: string
 *                 description: The unique URL of the table (UUID only, not full URL)
 *                 example: "3657dd61-fbb9-4769-b6a9-f96bb20d23f1"
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     food:
 *                       type: string
 *                       description: Food ID (MongoDB ObjectId) or Food Name
 *                       example: "6901db804837166e608118be"
 *                     quantity:
 *                       type: number
 *                     specialInstructions:
 *                       type: string
 *               customerName:
 *                 type: string
 *               customerPhone:
 *                 type: string
 *               customerEmail:
 *                 type: string
 *                 format: email
 *               paymentMethod:
 *                 type: string
 *                 enum: [cash, online]
 *               specialRequests:
 *                 type: string
 *     responses:
 *       201:
 *         description: Order placed successfully
 *       400:
 *         description: Validation error
 */
router.post('/orders', validate(createOrderSchema), publicController.placeOrder);

/**
 * @swagger
 * /api/public/orders/{orderNumber}:
 *   get:
 *     summary: Get order status (for customer tracking)
 *     tags: [Public]
 *     parameters:
 *       - in: path
 *         name: orderNumber
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Order status fetched
 *       404:
 *         description: Order not found
 */
router.get('/orders/:orderNumber', publicController.getOrderStatus);

/**
 * @swagger
 * /api/public/orders/search/{phone}:
 *   get:
 *     summary: Search customer orders by mobile number
 *     description: Get all orders for a customer using their mobile number. Active orders appear first, sorted by most recent.
 *     tags: [Public]
 *     parameters:
 *       - in: path
 *         name: phone
 *         required: true
 *         schema:
 *           type: string
 *         description: Customer mobile number
 *         example: "01712345678"
 *     responses:
 *       200:
 *         description: Orders fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 statusCode:
 *                   type: number
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalOrders:
 *                       type: number
 *                       description: Total number of orders
 *                     activeOrders:
 *                       type: number
 *                       description: Number of active orders (pending, confirmed, preparing, ready, served)
 *                     orders:
 *                       type: array
 *                       description: List of orders (active orders first, then completed/cancelled)
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           orderNumber:
 *                             type: string
 *                           restaurant:
 *                             type: object
 *                             properties:
 *                               name:
 *                                 type: string
 *                               logo:
 *                                 type: string
 *                               phone:
 *                                 type: string
 *                               address:
 *                                 type: string
 *                           table:
 *                             type: object
 *                             properties:
 *                               tableNumber:
 *                                 type: string
 *                               location:
 *                                 type: string
 *                           items:
 *                             type: array
 *                             items:
 *                               type: object
 *                               properties:
 *                                 food:
 *                                   type: object
 *                                   properties:
 *                                     name:
 *                                       type: string
 *                                     category:
 *                                       type: string
 *                                     image:
 *                                       type: string
 *                                 name:
 *                                   type: string
 *                                 price:
 *                                   type: number
 *                                 quantity:
 *                                   type: number
 *                                 specialInstructions:
 *                                   type: string
 *                           totalAmount:
 *                             type: number
 *                           orderStatus:
 *                             type: string
 *                             enum: [pending, confirmed, preparing, ready, served, completed, cancelled]
 *                           paymentStatus:
 *                             type: string
 *                             enum: [pending, completed, failed, refunded]
 *                           paymentMethod:
 *                             type: string
 *                             enum: [cash, online]
 *                           estimatedTime:
 *                             type: number
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                           updatedAt:
 *                             type: string
 *                             format: date-time
 *       404:
 *         description: No orders found for this mobile number
 *       400:
 *         description: Mobile number is required
 */
router.get('/orders/search/:phone', publicController.getOrdersByPhone);

/**
 * @swagger
 * /api/public/table/{tableUrl}/menus:
 *   get:
 *     summary: Get all active menus for a restaurant (for customers)
 *     description: Returns all active menus with their foods that are available at the current time and day
 *     tags: [Public]
 *     parameters:
 *       - in: path
 *         name: tableUrl
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique table URL
 *         example: "3657dd61-fbb9-4769-b6a9-f96bb20d23f1"
 *     responses:
 *       200:
 *         description: Menus fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 statusCode:
 *                   type: number
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     restaurant:
 *                       type: object
 *                       properties:
 *                         name:
 *                           type: string
 *                         description:
 *                           type: string
 *                         logo:
 *                           type: string
 *                     menus:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           name:
 *                             type: string
 *                           description:
 *                             type: string
 *                           foods:
 *                             type: array
 *                           isActive:
 *                             type: boolean
 *                           displayOrder:
 *                             type: number
 *                     count:
 *                       type: number
 *       404:
 *         description: Table not found
 *       403:
 *         description: Restaurant is closed
 */
router.get('/table/:tableUrl/menus', publicController.getRestaurantMenus);

/**
 * @swagger
 * /api/public/table/{tableUrl}/menus/{menuId}:
 *   get:
 *     summary: Get specific menu details with all foods (for customers)
 *     description: Returns detailed information about a specific menu including all available foods
 *     tags: [Public]
 *     parameters:
 *       - in: path
 *         name: tableUrl
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique table URL
 *         example: "3657dd61-fbb9-4769-b6a9-f96bb20d23f1"
 *       - in: path
 *         name: menuId
 *         required: true
 *         schema:
 *           type: string
 *         description: Menu ID
 *         example: "69074c6503cc18c2ef443667"
 *     responses:
 *       200:
 *         description: Menu details fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 statusCode:
 *                   type: number
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     menu:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                         name:
 *                           type: string
 *                         description:
 *                           type: string
 *                         foods:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               _id:
 *                                 type: string
 *                               name:
 *                                 type: string
 *                               description:
 *                                 type: string
 *                               price:
 *                                 type: number
 *                               image:
 *                                 type: string
 *                               category:
 *                                 type: string
 *                               isAvailable:
 *                                 type: boolean
 *                               isBadge:
 *                                 type: boolean
 *                         isActive:
 *                           type: boolean
 *                         displayOrder:
 *                           type: number
 *                         availableFrom:
 *                           type: string
 *                         availableTo:
 *                           type: string
 *                         availableDays:
 *                           type: array
 *                           items:
 *                             type: string
 *                     restaurant:
 *                       type: object
 *                       properties:
 *                         name:
 *                           type: string
 *                         logo:
 *                           type: string
 *       404:
 *         description: Table or menu not found
 *       403:
 *         description: Menu not available at this time
 */
router.get('/table/:tableUrl/menus/:menuId', publicController.getMenuDetails);

export default router;
