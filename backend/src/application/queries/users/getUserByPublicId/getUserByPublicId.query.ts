import { IQuery } from "../../../common/interfaces/query.interface";

export class GetUserByPublicIdQuery implements IQuery {
	readonly type = "GetUserByPublicIdQuery";

	constructor(public readonly publicId: string) {}
}
