import { IQuery } from "../../../common/interfaces/query.interface";

export class GetCommunityFeedQuery implements IQuery {
	readonly type = "GetCommunityFeedQuery";

	constructor(
		public readonly communityId: string,
		public readonly page: number = 1,
		public readonly limit: number = 20
	) {}
}
