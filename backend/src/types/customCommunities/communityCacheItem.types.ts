import { ObjectId } from "mongoose";

export interface ICommunityCacheItem {
	_id: ObjectId; // community id
	name: string;
	slug: string;
	icon?: string;
}
