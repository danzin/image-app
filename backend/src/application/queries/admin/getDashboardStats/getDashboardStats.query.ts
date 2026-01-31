import { IQuery } from "@/application/common/interfaces/query.interface";

export class GetDashboardStatsQuery implements IQuery {
	readonly type = "GetDashboardStatsQuery";
}
