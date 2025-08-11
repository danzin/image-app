import { Request, Response, NextFunction, RequestHandler } from "express";

import { createError } from "../utils/errors";
import { ValidationSchema } from "../utils/schemals/user.schemas";

export class ValidationMiddleware {
	constructor(private schemas: ValidationSchema) {}

	validate(): RequestHandler {
		return (req: Request, _res: Response, next: NextFunction) => {
			try {
				if (this.schemas.body) {
					req.body = this.schemas.body.validate(req.body, {
						abortEarly: false,
					}).value;
				}

				if (this.schemas.params) {
					req.params = this.schemas.params.validate(req.params, {
						abortEarly: false,
					}).value;
				}

				if (this.schemas.query) {
					req.query = this.schemas.query.validate(req.query, {
						abortEarly: false,
					}).value;
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
