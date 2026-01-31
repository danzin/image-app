import { IQuery } from "@/application/common/interfaces/query.interface";

export class GetTrendingTagsQuery implements IQuery {
	readonly type = "GetTrendingTagsQuery";
	constructor(
		public readonly limit: number = 5,
		public readonly timeWindowHours: number = 168
	) {}
}
