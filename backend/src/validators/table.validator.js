import Joi from 'joi';

export const createTableSchema = Joi.object({
  tableNumber: Joi.string()
    .required()
    .messages({
      'any.required': 'Table number is required'
    }),
  capacity: Joi.number()
    .min(1)
    .default(4)
    .messages({
      'number.min': 'Capacity must be at least 1'
    }),
  location: Joi.string()
    .allow('')
});

export const updateTableSchema = Joi.object({
  tableNumber: Joi.string(),
  capacity: Joi.number()
    .min(1)
    .messages({
      'number.min': 'Capacity must be at least 1'
    }),
  location: Joi.string()
    .allow(''),
  isActive: Joi.boolean()
});
