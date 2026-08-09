import Joi from 'joi';

export const createOrderSchema = Joi.object({
  tableUrl: Joi.string()
    .required()
    .messages({
      'any.required': 'Table URL is required'
    }),
  items: Joi.array()
    .items(
      Joi.object({
        food: Joi.string()
          .required()
          .messages({
            'any.required': 'Food ID is required'
          }),
        quantity: Joi.number()
          .min(1)
          .required()
          .messages({
            'number.min': 'Quantity must be at least 1',
            'any.required': 'Quantity is required'
          }),
        specialInstructions: Joi.string().allow('')
      })
    )
    .min(1)
    .required()
    .messages({
      'array.min': 'At least one item is required',
      'any.required': 'Items are required'
    }),
  customerName: Joi.string()
    .allow(''),
  customerPhone: Joi.string()
    .pattern(/^[0-9+\-\s()]+$/)
    .allow('')
    .messages({
      'string.pattern.base': 'Invalid phone number format'
    }),
  customerEmail: Joi.string()
    .email()
    .allow('')
    .messages({
      'string.email': 'Invalid email format'
    }),
  paymentMethod: Joi.string()
    .valid('cash', 'online')
    .required()
    .messages({
      'any.only': 'Payment method must be either cash or online',
      'any.required': 'Payment method is required'
    }),
  specialRequests: Joi.string().allow('')
});

export const updateOrderStatusSchema = Joi.object({
  status: Joi.string()
    .valid('pending', 'confirmed', 'preparing', 'ready', 'served', 'completed', 'cancelled')
    .required()
    .messages({
      'any.only': 'Invalid order status',
      'any.required': 'Status is required'
    }),
  note: Joi.string().allow('')
});

export const updateEstimatedTimeSchema = Joi.object({
  estimatedTime: Joi.number()
    .min(0)
    .required()
    .messages({
      'number.min': 'Estimated time cannot be negative',
      'any.required': 'Estimated time is required'
    })
});

export const updatePaymentStatusSchema = Joi.object({
  paymentStatus: Joi.string()
    .valid('pending', 'completed', 'failed', 'refunded')
    .required()
    .messages({
      'any.only': 'Invalid payment status. Must be: pending, completed, failed, or refunded',
      'any.required': 'Payment status is required'
    })
});
