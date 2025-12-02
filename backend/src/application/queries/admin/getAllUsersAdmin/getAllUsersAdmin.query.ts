import { IQuery } from "../../../common/interfaces/query.interface";
import { PaginationOptions } from "../../../../types";

export class GetAllUsersAdminQuery implements IQuery {
	readonly type = "GetAllUsersAdminQuery";

	constructor(public readonly options: PaginationOptions) {}
}
