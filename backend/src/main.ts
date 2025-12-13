import "reflect-metadata";
import { errorLogger, logger } from "./utils/winston";
import { Worker } from "worker_threads";
import path from "path";
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config({ path: "../.env" });
logger.info("MONGODB_URI in main:", process.env.MONGODB_URI);
// Register global mongoose plugin before individual models
mongoose.plugin((schema) => {
	schema.set("toJSON", {
		transform: (doc, ret: Record<string, any>) => {
			if (ret._id) {
				ret.id = ret._id.toString();
				delete ret._id;
			}
			delete ret.__v;
			return ret;
		},
	});
});

import { createServer } from "http";
import { container } from "tsyringe";
import { DatabaseConfig } from "./config/dbConfig";
import { Server } from "./server/server";
import { setupContainerCore, registerCQRS, initCQRS } from "./di/container";
import { WebSocketServer } from "./server/socketServer";
import { RealTimeFeedService } from "./services/real-time-feed.service";

// Global error handlers
process.on("uncaughtException", (error: Error) => {
	errorLogger.error({
		type: "UncaughtException",
		message: error.message,
		stack: error.stack,
		timestamp: new Date().toISOString(),
	});
	console.error("Uncaught Exception:", error);
	process.exit(1);
});

process.on("unhandledRejection", (reason: any, promise: Promise<any>) => {
	errorLogger.error({
		type: "UnhandledRejection",
		reason: reason?.message || reason,
		stack: reason?.stack,
		promise: String(promise),
		timestamp: new Date().toISOString(),
	});
	console.error("Unhandled Rejection:", reason);
});

async function bootstrap(): Promise<void> {
	try {
		// make sure core registrations are in place
		setupContainerCore();

		// Register CQRS tokens

		registerCQRS();

		// Connect to database
		const dbConfig = container.resolve(DatabaseConfig);
		await dbConfig.connect();

		// Now that DB connection is established, resolve & wire CQRS handlers (buses, handlers, subscriptions).
		initCQRS();

		// Initialize workers
		startWorker("trending.worker");
		startWorker("profile-sync.worker");

		// Create Express app and HTTP server
		const expressServer = container.resolve(Server);
		const app = expressServer.getExpressApp();
		const server = createServer(app);

		// Resolve and initialize WebSocket server
		const webSocketServer = container.resolve<WebSocketServer>("WebSocketServer");
		webSocketServer.initialize(server);

		// Initialize real-time feed service
		const realTimeFeedService = container.resolve<RealTimeFeedService>("RealTimeFeedService");
		logger.info("Real-time feed service initialized");

		// Start the HTTP server last
		const port = 3000;
		expressServer.start(server, port);
	} catch (error) {
		console.error("Startup failed", error);
		process.exit(1);
	}
}

function startWorker(fileName: string) {
	const extension = __filename.endsWith(".ts") ? "ts" : "js";
	const workerFilename = fileName.replace(".ts", extension).replace(".js", extension);

	const workerPath = path.resolve(__dirname, "./workers/", workerFilename);

	const worker = new Worker(workerPath, {
		workerData: { env: process.env.NODE_ENV },
		execArgv: __filename.endsWith(".ts") ? ["-r", "ts-node/register"] : undefined,
	});

	worker.on("error", (err) => {
		errorLogger.error({
			type: "WorkerError",
			worker: fileName,
			message: err.message,
			stack: err.stack,
			timestamp: new Date().toISOString(),
		});
		logger.error(`Worker ${fileName} error:`, err);
	});

	worker.on("exit", (code) => {
		if (code !== 0) {
			logger.warn(`Worker ${fileName} stopped with exit code ${code}`);
			setTimeout(() => startWorker(fileName), 5000);
		}
	});

	logger.info(`Started worker: ${fileName}`);
}

bootstrap().catch(console.error);
