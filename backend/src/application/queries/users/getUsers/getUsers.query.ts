import { IQuery } from "@/application/common/interfaces/query.interface";
import { PaginationOptions } from "@/types";

export class GetUsersQuery implements IQuery {
	readonly type = "GetUsersQuery";

	constructor(public readonly options: PaginationOptions) {}
}
