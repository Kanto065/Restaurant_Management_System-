import express from 'express';
import paymentController from './payment.controller.js';

const router = express.Router();

/**
 * @swagger
 * /api/payment/success:
 *   post:
 *     summary: Payment success callback (SSLCommerz)
 *     tags: [Payment]
 *     responses:
 *       200:
 *         description: Payment successful
 */
router.post('/success', paymentController.success);

/**
 * @swagger
 * /api/payment/fail:
 *   post:
 *     summary: Payment fail callback (SSLCommerz)
 *     tags: [Payment]
 *     responses:
 *       200:
 *         description: Payment failed
 */
router.post('/fail', paymentController.fail);

/**
 * @swagger
 * /api/payment/cancel:
 *   post:
 *     summary: Payment cancel callback (SSLCommerz)
 *     tags: [Payment]
 *     responses:
 *       200:
 *         description: Payment cancelled
 */
router.post('/cancel', paymentController.cancel);

/**
 * @swagger
 * /api/payment/ipn:
 *   post:
 *     summary: Payment IPN callback (SSLCommerz)
 *     tags: [Payment]
 *     responses:
 *       200:
 *         description: IPN received
 */
router.post('/ipn', paymentController.ipn);

export default router;
