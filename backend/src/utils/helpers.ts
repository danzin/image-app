import mongoose from "mongoose";
import { errorLogger } from "./winston";

export const convertToObjectId = (id: string): mongoose.Types.ObjectId => {
	return new mongoose.Types.ObjectId(id);
};

export function safeFireAndForget(promise: any) {
	Promise.resolve(promise).catch((err) => {
		errorLogger.error("safeFireAndForget error", { err });
	});
}

export function generateSlug(input: string, maxLength?: number): string {
	let slug = input
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/(^-|-$)/g, "");
	if (maxLength) {
		slug = slug.slice(0, maxLength);
	}
	return slug;
}
