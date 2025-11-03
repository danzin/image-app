import { IQuery } from "../../../common/interfaces/query.interface";

export class SearchPostsByTagsQuery implements IQuery {
	readonly type = "SearchPostsByTagsQuery";

	constructor(
		public readonly tags: string[],
		public readonly page: number,
		public readonly limit: number
	) {}
}
