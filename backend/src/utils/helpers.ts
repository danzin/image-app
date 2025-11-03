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
