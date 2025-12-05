import { IQuery } from "../../../common/interfaces/query.interface";

export class CheckFollowStatusQuery implements IQuery {
	readonly type = "CheckFollowStatusQuery";

	constructor(
		public readonly followerPublicId: string,
		public readonly targetPublicId: string
	) {}
}
