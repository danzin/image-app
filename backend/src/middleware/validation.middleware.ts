import { Request, Response, NextFunction, RequestHandler } from "express";
import { z, ZodError } from "zod";
import { createError } from "../utils/errors";

interface ValidationSchema {
	body?: z.ZodTypeAny;
	query?: z.ZodTypeAny;
	params?: z.ZodTypeAny;
}

export class ValidationMiddleware {
	constructor(private schemas: ValidationSchema) {}

	validate(): RequestHandler {
		return async (req: Request, _res: Response, next: NextFunction) => {
			try {
				if (this.schemas.body) {
					req.body = await this.schemas.body.parseAsync(req.body);
				}
				if (this.schemas.query) {
					req.query = await this.schemas.query.parseAsync(req.query);
				}
				if (this.schemas.params) {
					req.params = await this.schemas.params.parseAsync(req.params);
				}
				next();
			} catch (error) {
				if (error instanceof ZodError) {
					const errorMessages = error.errors.map((e) => e.message).join(", ");
					next(createError("ValidationError", errorMessages));
				} else if (error instanceof Error) {
					next(createError("ValidationError", error.message));
				} else {
					next(createError("ValidationError", "Unknown validation error"));
				}
			}
		};
	}
}
