import { Request, Response, NextFunction, RequestHandler } from "express";
import Joi from "joi";
import { createError } from "../utils/errors";
import { ValidationSchema } from "../utils/schemals/user.schemas";

export class ValidationMiddleware {
	constructor(private schemas: ValidationSchema) {}

	validate(): RequestHandler {
		return (req: Request, _res: Response, next: NextFunction) => {
			try {
				if (this.schemas.body) {
					const { error, value } = (this.schemas.body as Joi.Schema).validate(req.body, { abortEarly: false });
					if (error) throw error;
					req.body = value;
				}

				if (this.schemas.params) {
					const { error, value } = (this.schemas.params as Joi.Schema).validate(req.params, { abortEarly: false });
					if (error) throw error;
					req.params = value as any;
				}

				if (this.schemas.query) {
					const { error, value } = (this.schemas.query as Joi.Schema).validate(req.query, { abortEarly: false });
					if (error) throw error;
					req.query = value as any;
				}

				next();
			} catch (error) {
				if (error instanceof Error) {
					next(createError("ValidationError", error.message));
				} else {
					next(createError("ValidationError", "Unknown validation error"));
				}
			}
		};
	}
}
