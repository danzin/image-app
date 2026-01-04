import { IQuery } from "../../../common/interfaces/query.interface";

export class GetCommunityMembersQuery implements IQuery {
	readonly type = "GetCommunityMembersQuery";

	constructor(
		public readonly communitySlug: string,
		public readonly page: number = 1,
		public readonly limit: number = 20
	) {}
}
