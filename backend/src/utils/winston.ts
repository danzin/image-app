import winston from "winston";

export const httpLogger = winston.createLogger({
	level: "info",
	format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
	transports: [new winston.transports.File({ filename: "http-requests.log" })],
});

export const behaviourLogger = winston.createLogger({
	level: "info",
	format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
	transports: [new winston.transports.File({ filename: "app-behaviour.log" })],
});

export const errorLogger = winston.createLogger({
	level: "error",
	format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
	transports: [
		new winston.transports.File({ filename: "errors.log" }),
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
	transports: [new winston.transports.File({ filename: "detailed-requests.log" })],
});
