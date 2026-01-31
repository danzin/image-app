import { IQuery } from "@/application/common/interfaces/query.interface";

export class GetAllTagsQuery implements IQuery {
	readonly type = "GetAllTagsQuery";
}
