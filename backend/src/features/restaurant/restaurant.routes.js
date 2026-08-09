import express from 'express';
import restaurantController from './restaurant.controller.js';
import { protect } from '../../middlewares/auth.js';
import validate from '../../middlewares/validate.js';
import { updateRestaurantSchema } from '../../validators/restaurant.validator.js';
import upload from '../../utils/fileUpload.js';

const router = express.Router();

/**
 * @swagger
 * /api/restaurant:
 *   get:
 *     summary: Get restaurant details
 *     tags: [Restaurant]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Restaurant details fetched
 *       404:
 *         description: Restaurant not found
 */
router.get('/', protect, restaurantController.getRestaurant);

/**
 * @swagger
 * /api/restaurant:
 *   put:
 *     summary: Update restaurant details
 *     tags: [Restaurant]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 maxLength: 100
 *               description:
 *                 type: string
 *                 maxLength: 1000
 *               phone:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               address:
 *                 type: object
 *                 properties:
 *                   street:
 *                     type: string
 *                   city:
 *                     type: string
 *                   state:
 *                     type: string
 *                   zipCode:
 *                     type: string
 *                   country:
 *                     type: string
 *               openingHours:
 *                 type: object
 *     responses:
 *       200:
 *         description: Restaurant updated successfully
 */
router.put('/', protect, validate(updateRestaurantSchema), restaurantController.updateRestaurant);

/**
 * @swagger
 * /api/restaurant/logo:
 *   post:
 *     summary: Upload restaurant logo
 *     tags: [Restaurant]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - logo
 *             properties:
 *               logo:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Logo uploaded successfully
 *       400:
 *         description: No file uploaded or invalid file
 */
router.post('/logo', protect, upload.single('logo'), restaurantController.uploadLogo);

/**
 * @swagger
 * /api/restaurant/logo:
 *   delete:
 *     summary: Delete restaurant logo
 *     tags: [Restaurant]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logo deleted successfully
 */
router.delete('/logo', protect, restaurantController.deleteLogo);

export default router;
