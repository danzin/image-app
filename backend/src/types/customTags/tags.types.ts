import { Document } from "mongoose";

export interface TrendingTag {
	tag: string;
	count: number;
	recentPostCount: number;
}

export interface ITag extends Document {
	_id: any;
	tag: string;
	count?: number; // Optional because default value
	modifiedAt?: Date; // Optional becasue default value
}

export interface GetTrendingTagsResult {
	tags: TrendingTag[];
}
