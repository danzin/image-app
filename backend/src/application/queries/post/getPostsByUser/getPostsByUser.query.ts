import { IQuery } from "../../../common/interfaces/query.interface";

export class GetPostsByUserQuery implements IQuery {
	readonly type = "GetPostsByUserQuery";

	constructor(
		public readonly userPublicId: string,
		public readonly page: number,
		public readonly limit: number
	) {}
}
