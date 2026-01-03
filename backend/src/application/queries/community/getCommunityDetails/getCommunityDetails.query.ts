import { IQuery } from "../../../common/interfaces/query.interface";

export class GetCommunityDetailsQuery implements IQuery {
	readonly type = "GetCommunityDetailsQuery";

	constructor(
		public readonly slug: string,
		public readonly viewerPublicId?: string
	) {}
}
