import Joi from 'joi';

export const createMenuSchema = Joi.object({
  name: Joi.string()
    .max(100)
    .required()
    .messages({
      'string.max': 'Menu name cannot exceed 100 characters',
      'any.required': 'Menu name is required'
    }),
  description: Joi.string()
    .max(500)
    .allow('')
    .messages({
      'string.max': 'Description cannot exceed 500 characters'
    }),
  foods: Joi.array()
    .items(Joi.string().pattern(/^[0-9a-fA-F]{24}$/))
    .default([])
    .messages({
      'string.pattern.base': 'Invalid food ID format'
    }),
  isActive: Joi.boolean().default(true),
  displayOrder: Joi.number().default(0),
  availableFrom: Joi.string()
    .pattern(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .allow(null)
    .messages({
      'string.pattern.base': 'Invalid time format. Use HH:MM (e.g., 09:00)'
    }),
  availableTo: Joi.string()
    .pattern(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .allow(null)
    .messages({
      'string.pattern.base': 'Invalid time format. Use HH:MM (e.g., 22:00)'
    }),
  availableDays: Joi.array()
    .items(Joi.string().valid('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'))
    .default(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'])
});

export const updateMenuSchema = Joi.object({
  name: Joi.string()
    .max(100)
    .messages({
      'string.max': 'Menu name cannot exceed 100 characters'
    }),
  description: Joi.string()
    .max(500)
    .allow('')
    .messages({
      'string.max': 'Description cannot exceed 500 characters'
    }),
  foods: Joi.array()
    .items(Joi.string().pattern(/^[0-9a-fA-F]{24}$/))
    .messages({
      'string.pattern.base': 'Invalid food ID format'
    }),
  isActive: Joi.boolean(),
  displayOrder: Joi.number(),
  availableFrom: Joi.string()
    .pattern(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .allow(null)
    .messages({
      'string.pattern.base': 'Invalid time format. Use HH:MM (e.g., 09:00)'
    }),
  availableTo: Joi.string()
    .pattern(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .allow(null)
    .messages({
      'string.pattern.base': 'Invalid time format. Use HH:MM (e.g., 22:00)'
    }),
  availableDays: Joi.array()
    .items(Joi.string().valid('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'))
});

export const addFoodsSchema = Joi.object({
  foodIds: Joi.array()
    .items(Joi.string().pattern(/^[0-9a-fA-F]{24}$/))
    .min(1)
    .required()
    .messages({
      'array.min': 'At least one food ID is required',
      'any.required': 'Food IDs are required',
      'string.pattern.base': 'Invalid food ID format'
    })
});

export const removeFoodsSchema = Joi.object({
  foodIds: Joi.array()
    .items(Joi.string().pattern(/^[0-9a-fA-F]{24}$/))
    .min(1)
    .required()
    .messages({
      'array.min': 'At least one food ID is required',
      'any.required': 'Food IDs are required',
      'string.pattern.base': 'Invalid food ID format'
    })
});

export const reorderFoodsSchema = Joi.object({
  foodIds: Joi.array()
    .items(Joi.string().pattern(/^[0-9a-fA-F]{24}$/))
    .min(1)
    .required()
    .messages({
      'array.min': 'At least one food ID is required',
      'any.required': 'Food IDs are required',
      'string.pattern.base': 'Invalid food ID format'
    })
});

export const updateMenuOrderSchema = Joi.object({
  menuOrders: Joi.array()
    .items(
      Joi.object({
        menuId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
        displayOrder: Joi.number().required()
      })
    )
    .min(1)
    .required()
    .messages({
      'array.min': 'At least one menu order is required',
      'any.required': 'Menu orders are required'
    })
});
