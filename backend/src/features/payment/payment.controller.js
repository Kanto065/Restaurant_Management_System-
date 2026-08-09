import asyncHandler from '../../utils/asyncHandler.js';
import ApiResponse from '../../utils/ApiResponse.js';
import Order from '../../models/Order.js';
import paymentService from './payment.service.js';

class PaymentController {
  /**
   * @desc    Payment success callback
   * @route   POST /api/payment/success
   * @access  Public
   */
  success = asyncHandler(async (req, res) => {
    const { tran_id, val_id, amount, card_type, card_issuer, bank_tran_id } = req.body;
    
    // Validate payment with SSLCommerz
    const validation = await paymentService.validatePayment(val_id);
    
    if (validation.status === 'VALID' || validation.status === 'VALIDATED') {
      // Extract order ID from transaction ID
      const orderNumber = tran_id.replace('TXN-', '');
      
      // Update order
      const order = await Order.findOne({ orderNumber });
      
      if (order) {
        order.paymentStatus = 'completed';
        order.paymentDetails = {
          transactionId: tran_id,
          bankTransactionId: bank_tran_id,
          cardType: card_type,
          cardIssuer: card_issuer,
          paymentTime: new Date()
        };
        await order.save();
        
        // Emit socket event for real-time update
        const io = req.app.get('io');
        if (io) {
          io.to(`restaurant-${order.restaurant}`).emit('payment-completed', {
            orderId: order._id,
            orderNumber: order.orderNumber
          });
        }
      }
      
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Payment Successful</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            .success { color: #28a745; }
            .container { max-width: 600px; margin: 0 auto; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1 class="success">✓ Payment Successful!</h1>
            <p>Your order has been confirmed.</p>
            <p>Order Number: <strong>${order?.orderNumber}</strong></p>
            <p>Amount: <strong>${amount} BDT</strong></p>
            <p>Transaction ID: <strong>${tran_id}</strong></p>
            <p>You can close this window now.</p>
          </div>
        </body>
        </html>
      `);
    } else {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Payment Failed</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            .error { color: #dc3545; }
            .container { max-width: 600px; margin: 0 auto; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1 class="error">✗ Payment Validation Failed</h1>
            <p>Please try again or contact support.</p>
          </div>
        </body>
        </html>
      `);
    }
  });
  
  /**
   * @desc    Payment fail callback
   * @route   POST /api/payment/fail
   * @access  Public
   */
  fail = asyncHandler(async (req, res) => {
    const { tran_id } = req.body;
    
    // Extract order number
    const orderNumber = tran_id.replace('TXN-', '');
    
    // Update order
    const order = await Order.findOne({ orderNumber });
    if (order) {
      order.paymentStatus = 'failed';
      await order.save();
    }
    
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Payment Failed</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
          .error { color: #dc3545; }
          .container { max-width: 600px; margin: 0 auto; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1 class="error">✗ Payment Failed</h1>
          <p>Your payment could not be processed.</p>
          <p>Please try again.</p>
        </div>
      </body>
      </html>
    `);
  });
  
  /**
   * @desc    Payment cancel callback
   * @route   POST /api/payment/cancel
   * @access  Public
   */
  cancel = asyncHandler(async (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Payment Cancelled</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
          .warning { color: #ffc107; }
          .container { max-width: 600px; margin: 0 auto; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1 class="warning">Payment Cancelled</h1>
          <p>You have cancelled the payment.</p>
          <p>You can close this window and try again.</p>
        </div>
      </body>
      </html>
    `);
  });
  
  /**
   * @desc    Payment IPN (Instant Payment Notification)
   * @route   POST /api/payment/ipn
   * @access  Public
   */
  ipn = asyncHandler(async (req, res) => {
    const { tran_id, val_id, status } = req.body;
    
    console.log('IPN Received:', req.body);
    
    if (status === 'VALID' || status === 'VALIDATED') {
      const orderNumber = tran_id.replace('TXN-', '');
      const order = await Order.findOne({ orderNumber });
      
      if (order && order.paymentStatus !== 'completed') {
        order.paymentStatus = 'completed';
        await order.save();
      }
    }
    
    res.status(200).json({ message: 'IPN received' });
  });
}

export default new PaymentController();
