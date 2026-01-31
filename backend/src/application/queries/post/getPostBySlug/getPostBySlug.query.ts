import { IQuery } from "@/application/common/interfaces/query.interface";

export class GetPostBySlugQuery implements IQuery {
	readonly type = "GetPostBySlugQuery";

	constructor(public readonly slug: string) {}
}
