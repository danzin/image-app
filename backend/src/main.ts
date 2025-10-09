//enables the usage of decorators and metadata reflection in TypeScript
import "reflect-metadata";
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config({ path: "../.env" });
// Register global mongoose plugin before individual models
mongoose.plugin((schema) => {
	schema.set("toJSON", {
		transform: (doc, ret: Record<string, any>) => {
			// console.log('Global plugin transforming document:', ret);
			ret.id = ret._id.toString();
			delete ret._id;
			delete ret.__v;
			return ret;
		},
	});
});

import { createServer } from "http";
import { container } from "tsyringe";
import { DatabaseConfig } from "./config/dbConfig";
import { Server } from "./server/server";
import { setupContainer } from "./di/container";
import { WebSocketServer } from "./server/socketServer";
import { RealTimeFeedService } from "./services/real-time-feed.service";
import { errorLogger } from "./utils/winston";

// Global error handlers for uncaught exceptions
process.on("uncaughtException", (error: Error) => {
	errorLogger.error({
		type: "UncaughtException",
		message: error.message,
		stack: error.stack,
		timestamp: new Date().toISOString(),
	});
	console.error("Uncaught Exception:", error);
	process.exit(1); // Exit process after logging
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
		// Connect to database

		// containter.resolve() asks the tsyringe DI container
		// to construct the instance and automatically inject dependencies
		// instead of new-ing it and injecting manually
		const dbConfig = container.resolve(DatabaseConfig);
		await dbConfig.connect();

		// Setup dependency injection

		setupContainer(); // Registers all deps in the DI container

		// Create Express app and HTTP server
		const expressServer = container.resolve(Server);
		const app = expressServer.getExpressApp();
		const server = createServer(app);

		// Resolve and initialize WebSocket server
		const webSocketServer = container.resolve<WebSocketServer>("WebSocketServer");
		webSocketServer.initialize(server);

		// Initialize real-time feed service
		const realTimeFeedService = container.resolve<RealTimeFeedService>("RealTimeFeedService");
		console.log("Real-time feed service initialized");

		// Start the HTTP server last
		const port = 3000;
		expressServer.start(server, port);
	} catch (error) {
		console.error("Startup failed", error);
		process.exit(1);
	}
}

bootstrap().catch(console.error);
