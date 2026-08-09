import Joi from 'joi';

export const createFoodSchema = Joi.object({
  name: Joi.string()
    .max(100)
    .required()
    .messages({
      'string.max': 'Food name cannot exceed 100 characters',
      'any.required': 'Food name is required'
    }),
  description: Joi.string()
    .max(500)
    .allow('')
    .messages({
      'string.max': 'Description cannot exceed 500 characters'
    }),
  price: Joi.number()
    .min(0)
    .required()
    .messages({
      'number.min': 'Price cannot be negative',
      'any.required': 'Price is required'
    }),
  category: Joi.string()
    .valid('Appetizer', 'Main Course', 'Dessert', 'Beverage', 'Snack', 'Other')
    .default('Other'),
  isVegetarian: Joi.boolean().default(false),
  isAvailable: Joi.boolean().default(true),
  isBadge: Joi.boolean().default(false),
  preparationTime: Joi.number()
    .min(0)
    .default(15)
    .messages({
      'number.min': 'Preparation time cannot be negative'
    }),
  spiceLevel: Joi.string()
    .valid('None', 'Mild', 'Medium', 'Hot', 'Extra Hot')
    .default('None')
});

export const updateFoodSchema = Joi.object({
  name: Joi.string()
    .max(100)
    .messages({
      'string.max': 'Food name cannot exceed 100 characters'
    }),
  description: Joi.string()
    .max(500)
    .allow('')
    .messages({
      'string.max': 'Description cannot exceed 500 characters'
    }),
  price: Joi.number()
    .min(0)
    .messages({
      'number.min': 'Price cannot be negative'
    }),
  category: Joi.string()
    .valid('Appetizer', 'Main Course', 'Dessert', 'Beverage', 'Snack', 'Other'),
  isVegetarian: Joi.boolean(),
  isAvailable: Joi.boolean(),
  isBadge: Joi.boolean(),
  preparationTime: Joi.number()
    .min(0)
    .messages({
      'number.min': 'Preparation time cannot be negative'
    }),
  spiceLevel: Joi.string()
    .valid('None', 'Mild', 'Medium', 'Hot', 'Extra Hot')
});
