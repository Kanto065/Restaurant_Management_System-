import Joi from 'joi';
import AppError from '../utils/AppError.js';

/**
 * Validate request body, query, or params against Joi schema
 */
const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true
    });
    
    if (error) {
      const message = error.details.map(detail => detail.message).join(', ');
      throw new AppError(message, 400);
    }
    
    // Replace request property with validated value
    req[property] = value;
    next();
  };
};

export default validate;
