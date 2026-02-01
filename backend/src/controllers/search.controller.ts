import { NextFunction, Request, Response } from "express";
import { SearchService } from "@/services/search.service";
import { createError } from "@/utils/errors";
import { sanitizeTextInput } from "@/utils/sanitizers";
import { inject, injectable } from "tsyringe";

@injectable()
export class SearchController {
	constructor(@inject("SearchService") private readonly searchService: SearchService) {}

	searchAll = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const { q } = req.query;

			const queryValue = String(q || "");
			if (!queryValue.trim()) {
				throw createError("ValidationError", 'Query parameter "q" is required');
			}

			const searchTerms = queryValue.split(",").reduce<string[]>((acc, term) => {
				const trimmed = term.trim();
				if (!trimmed) {
					return acc;
				}

				try {
					acc.push(sanitizeTextInput(trimmed, 100));
				} catch (error) {
					const message = error instanceof Error ? error.message : "Invalid search term";
					throw createError("ValidationError", message);
				}
				return acc;
			}, []);

			if (searchTerms.length === 0) {
				throw createError("ValidationError", 'Query parameter "q" is required');
			}

			const result = await this.searchService.searchAll(searchTerms);

			res.status(200).json({ success: true, data: result });
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			const name = error instanceof Error ? error.name : "Error";
			next(createError(name, message));
		}
	};
}
