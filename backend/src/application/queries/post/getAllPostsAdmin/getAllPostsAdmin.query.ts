import { IQuery } from "../../../common/interfaces/query.interface";

export class GetAllPostsAdminQuery implements IQuery {
	readonly type = "GetAllPostsAdminQuery";

	constructor(
		public readonly page: number,
		public readonly limit: number,
		public readonly sortBy?: string,
		public readonly sortOrder?: "asc" | "desc"
	) {}
}
