import { IQuery } from "@/application/common/interfaces/query.interface";

export class GetLikedPostsByUserQuery implements IQuery {
	readonly type = "GetLikedPostsByUserQuery";

	constructor(
		public readonly userPublicId: string,
		public readonly page: number,
		public readonly limit: number,
		public readonly viewerPublicId?: string,
		public readonly sortBy: string = "createdAt",
		public readonly sortOrder: "asc" | "desc" = "desc"
	) {}
}
