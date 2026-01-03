import { Types } from "mongoose";

export interface ICommunityCacheItem {
	_id: Types.ObjectId; // community id
	name: string;
	slug: string;
	icon?: string;
}
