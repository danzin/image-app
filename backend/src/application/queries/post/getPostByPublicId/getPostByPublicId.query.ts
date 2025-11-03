import { IQuery } from "../../../common/interfaces/query.interface";

export class GetPostByPublicIdQuery implements IQuery {
	readonly type = "GetPostByPublicIdQuery";

	constructor(
		public readonly publicId: string,
		public readonly viewerPublicId?: string
	) {}
}
