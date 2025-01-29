import Joi, { Schema } from 'joi';

export class UserSchemas {
  static registration(): Joi.ObjectSchema {
    return Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string().min(1).required(),
      username: Joi.string().alphanum().min(1).max(30).required()
    });
  }

  static login(): Joi.ObjectSchema {
    return Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string().required()
    });
  }
  static followParams(): Joi.ObjectSchema {
    return Joi.object({
      targetUserId: Joi.string()
        .pattern(/^[0-9a-fA-F]{24}$/)
        .required()
        .messages({
          'string.pattern.base': 'Invalid target user ID format',
          'any.required': 'Target user ID is required'
        })
    }).options({ allowUnknown: false });
  }
}

  


export interface ValidationSchema {
  body?: Schema;
  params?: Schema;
  query?: Schema;
}

export class UserValidationSchemas {
  static registration(): ValidationSchema {
    return {
      body: Joi.object({
        email: Joi.string().email().required(),
        password: Joi.string().min(8).required()
      })
    };
  }

  static login(): ValidationSchema {
    return {
      body: Joi.object({
        email: Joi.string().email().required(),
        password: Joi.string().required()
      })
    };
  }
  static followAction(): ValidationSchema {
    return {
      params: UserSchemas.followParams()
    };
  }
}
