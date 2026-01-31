import mongoose, { Schema } from "mongoose";
import { IRequestLog } from "@/types";

const RequestLogSchema = new Schema<IRequestLog>(
	{
		timestamp: { type: Date, required: true },
		metadata: {
			userId: { type: String },
			method: { type: String, required: true },
			route: { type: String, required: true },
			ip: { type: String, required: true },
			userAgent: { type: String },
			statusCode: { type: Number, required: true },
			responseTimeMs: { type: Number, required: true },
		},
	},
	{
		timeseries: {
			timeField: "timestamp",
			metaField: "metadata",
			granularity: "seconds",
		},
		expireAfterSeconds: 60 * 60 * 24 * 30, // 30 days
	},
);

export const RequestLogModel = mongoose.model<IRequestLog>("RequestLog", RequestLogSchema);
