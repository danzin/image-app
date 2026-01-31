import { IQuery } from "@/application/common/interfaces/query.interface";

export class GetAdminUserProfileQuery implements IQuery {
	readonly type = "GetAdminUserProfileQuery";

	constructor(public readonly publicId: string) {}
}
