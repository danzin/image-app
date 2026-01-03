import { IQuery } from "../../../common/interfaces/query.interface";

export class GetAllCommunitiesQuery implements IQuery {
	readonly type = "GetAllCommunitiesQuery";

	constructor(
		public readonly page: number = 1,
		public readonly limit: number = 20,
		public readonly search?: string
	) {}
}
