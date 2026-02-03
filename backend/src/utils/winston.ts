import winston from "winston";

const isTest = process.env.NODE_ENV === "test";
const testTransport = isTest ? new winston.transports.Console({ silent: true }) : null;
const combinedTransport = isTest ? null : new winston.transports.File({ filename: "app.log" });

export const logger = winston.createLogger({
	level: "info",
	format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
	transports: [
		...(combinedTransport ? [combinedTransport] : []),
		...(testTransport ? [testTransport] : []),
		...(process.env.NODE_ENV !== "production" && !isTest
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
	transports: isTest
		? [...(testTransport ? [testTransport] : [])]
		: [new winston.transports.File({ filename: "http-requests.log" }), ...(combinedTransport ? [combinedTransport] : [])],
});

export const behaviourLogger = winston.createLogger({
	level: "info",
	format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
	transports: isTest
		? [...(testTransport ? [testTransport] : [])]
		: [
				new winston.transports.File({ filename: "app-behaviour.log" }),
				...(combinedTransport ? [combinedTransport] : []),
			],
});

export const errorLogger = winston.createLogger({
	level: "error",
	format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
	transports: [
		...(isTest ? [] : [new winston.transports.File({ filename: "errors.log" })]),
		...(combinedTransport ? [combinedTransport] : []),
		...(testTransport ? [testTransport] : []),
		// Also log to console in development
		...(process.env.NODE_ENV !== "production" && !isTest
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
	transports: isTest
		? [...(testTransport ? [testTransport] : [])]
		: [
				new winston.transports.File({ filename: "detailed-requests.log" }),
				...(combinedTransport ? [combinedTransport] : []),
			],
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
	transports: isTest
		? [...(testTransport ? [testTransport] : [])]
		: [new winston.transports.File({ filename: "redis.log" }), ...(combinedTransport ? [combinedTransport] : [])],
});
