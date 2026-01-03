import { IQuery } from "../../../common/interfaces/query.interface";

export class GetUserCommunitiesQuery implements IQuery {
	readonly type = "GetUserCommunitiesQuery";

	constructor(
		public readonly userId: string,
		public readonly page: number = 1,
		public readonly limit: number = 20
	) {}
}
