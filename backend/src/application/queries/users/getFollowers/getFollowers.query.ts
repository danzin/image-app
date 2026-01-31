import { IQuery } from "@/application/common/interfaces/query.interface";

export class GetFollowersQuery implements IQuery {
	readonly type = "GetFollowersQuery";
	constructor(
		public readonly userPublicId: string,
		public readonly page: number = 1,
		public readonly limit: number = 20
	) {}
}
