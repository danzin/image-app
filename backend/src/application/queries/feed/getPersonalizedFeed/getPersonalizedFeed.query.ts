import { IQuery } from "../../../common/interfaces/query.interface";

export class GetPersonalizedFeedQuery implements IQuery {
	readonly type = "GetPersonalizedFeedQuery";

	constructor(
		public readonly userId: string,
		public readonly page: number,
		public readonly limit: number
	) {}
}
