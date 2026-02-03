import { IQuery } from "@/application/common/interfaces/query.interface";

export class GetAccountInfoQuery implements IQuery {
	readonly type = "GetAccountInfoQuery";
	constructor(public readonly userPublicId: string) {}
}
