import { IQuery } from "@/application/common/interfaces/query.interface";

export class GetUserByUsernameQuery implements IQuery {
	readonly type = "GetUserByUsernameQuery";

	constructor(public readonly username: string) {}
}
