import { IQuery } from "@/application/common/interfaces/query.interface";

export class GetPostsQuery implements IQuery {
	readonly type = "GetPostsQuery";

	constructor(
		public readonly page: number,
		public readonly limit: number,
		public readonly userId?: string
	) {}
}
