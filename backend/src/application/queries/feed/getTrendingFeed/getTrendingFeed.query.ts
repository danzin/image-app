import { IQuery } from "../../../common/interfaces/query.interface";

export class GetTrendingFeedQuery implements IQuery {
	readonly type = "GetTrendingFeedQuery";
	constructor(
		public readonly page: number,
		public readonly limit: number
	) {}
}
