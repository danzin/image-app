import { NextFunction, Request, Response } from "express";
import { SearchService } from "@/services/search.service";
import { createError } from "@/utils/errors";
import { inject, injectable } from "tsyringe";

@injectable()
export class SearchController {
	constructor(@inject("SearchService") private readonly searchService: SearchService) {}

	searchAll = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const { q } = req.query;

			if (!q) {
				throw createError("ValidationError", 'Query parameter "q" is required');
			}

			const searchTerms = (q as string).split(",").map((term) => term.trim());

			const result = await this.searchService.searchAll(searchTerms);

			res.status(200).json({ success: true, data: result });
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			const name = error instanceof Error ? error.name : "Error";
			next(createError(name, message));
		}
	};
}
