import { IQuery } from "@/application/common/interfaces/query.interface";

export class GetTrendingFeedQuery implements IQuery {
	readonly type = "GetTrendingFeedQuery";
	constructor(
		public readonly page: number,
		public readonly limit: number
	) {}
}
