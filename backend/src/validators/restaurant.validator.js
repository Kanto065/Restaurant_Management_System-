import Joi from 'joi';

export const updateRestaurantSchema = Joi.object({
  name: Joi.string()
    .max(100)
    .messages({
      'string.max': 'Restaurant name cannot exceed 100 characters'
    }),
  description: Joi.string()
    .max(1000)
    .allow('')
    .messages({
      'string.max': 'Description cannot exceed 1000 characters'
    }),
  phone: Joi.string()
    .pattern(/^[0-9+\-\s()]+$/)
    .allow('')
    .messages({
      'string.pattern.base': 'Invalid phone number format'
    }),
  email: Joi.string()
    .email()
    .allow('')
    .messages({
      'string.email': 'Invalid email format'
    }),
  address: Joi.object({
    street: Joi.string().allow(''),
    city: Joi.string().allow(''),
    state: Joi.string().allow(''),
    zipCode: Joi.string().allow(''),
    country: Joi.string().default('Bangladesh')
  }),
  openingHours: Joi.object({
    monday: Joi.object({ open: Joi.string().allow(''), close: Joi.string().allow('') }),
    tuesday: Joi.object({ open: Joi.string().allow(''), close: Joi.string().allow('') }),
    wednesday: Joi.object({ open: Joi.string().allow(''), close: Joi.string().allow('') }),
    thursday: Joi.object({ open: Joi.string().allow(''), close: Joi.string().allow('') }),
    friday: Joi.object({ open: Joi.string().allow(''), close: Joi.string().allow('') }),
    saturday: Joi.object({ open: Joi.string().allow(''), close: Joi.string().allow('') }),
    sunday: Joi.object({ open: Joi.string().allow(''), close: Joi.string().allow('') })
  })
});
