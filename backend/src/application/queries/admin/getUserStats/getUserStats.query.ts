import { IQuery } from "../../../common/interfaces/query.interface";

export class GetUserStatsQuery implements IQuery {
	readonly type = "GetUserStatsQuery";

	constructor(public readonly userPublicId: string) {}
}
