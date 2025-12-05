import { IQuery } from "../../../common/interfaces/query.interface";
import { PaginationOptions } from "../../../../types";

export class GetRecentActivityQuery implements IQuery {
	readonly type = "GetRecentActivityQuery";

	constructor(public readonly options: PaginationOptions) {}
}
