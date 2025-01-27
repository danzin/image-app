// schemas/user.schemas.ts
import Joi, { Schema } from 'joi';

export class UserSchemas {
  static registration(): Joi.ObjectSchema {
    return Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string().min(8).required(),
      username: Joi.string().alphanum().min(3).max(30).required()
    });
  }

  static login(): Joi.ObjectSchema {
    return Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string().required()
    });
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
}