import { IQuery } from "@/application/common/interfaces/query.interface";

export interface GetRequestLogsOptions {
	page?: number;
	limit?: number;
	userId?: string;
	statusCode?: number;
	startDate?: Date;
	endDate?: Date;
	search?: string;
}

export class GetRequestLogsQuery implements IQuery {
	readonly type = "GetRequestLogsQuery";

	constructor(public readonly options: GetRequestLogsOptions = {}) {}
}
