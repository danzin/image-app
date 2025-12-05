import { IQuery } from "../../../common/interfaces/query.interface";

export class GetFollowingQuery implements IQuery {
	readonly type = "GetFollowingQuery";
	constructor(
		public readonly userPublicId: string,
		public readonly page: number = 1,
		public readonly limit: number = 20
	) {}
}
