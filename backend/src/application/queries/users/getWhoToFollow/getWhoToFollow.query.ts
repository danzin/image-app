import { IQuery } from "@/application/common/interfaces/query.interface";

export class GetWhoToFollowQuery implements IQuery {
	readonly type = "GetWhoToFollowQuery";
	constructor(
		public readonly userPublicId: string,
		public readonly limit: number = 5
	) {}
}
