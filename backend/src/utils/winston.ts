import winston from "winston";

const combinedTransport = new winston.transports.File({ filename: "app.log" });

export const logger = winston.createLogger({
	level: "info",
	format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
	transports: [
		combinedTransport,
		...(process.env.NODE_ENV !== "production"
			? [
					new winston.transports.Console({
						format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
					}),
				]
			: []),
	],
});

export const httpLogger = winston.createLogger({
	level: "info",
	format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
	transports: [new winston.transports.File({ filename: "http-requests.log" }), combinedTransport],
});

export const behaviourLogger = winston.createLogger({
	level: "info",
	format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
	transports: [new winston.transports.File({ filename: "app-behaviour.log" }), combinedTransport],
});

export const errorLogger = winston.createLogger({
	level: "error",
	format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
	transports: [
		new winston.transports.File({ filename: "errors.log" }),
		combinedTransport,
		// Also log to console in development
		...(process.env.NODE_ENV !== "production"
			? [
					new winston.transports.Console({
						format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
					}),
				]
			: []),
	],
});

export const detailedRequestLogger = winston.createLogger({
	level: "info",
	format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
	transports: [new winston.transports.File({ filename: "detailed-requests.log" }), combinedTransport],
});

export const redisLogger = winston.createLogger({
	level: "debug",
	format: winston.format.combine(
		winston.format.timestamp(),
		winston.format.colorize(),
		winston.format.printf(({ timestamp, level, message, ...meta }) => {
			const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : "";
			return `[${timestamp}] [REDIS] ${level}: ${message} ${metaStr}`;
		})
	),
	transports: [new winston.transports.File({ filename: "redis.log" }), combinedTransport],
});
