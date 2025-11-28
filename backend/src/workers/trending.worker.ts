import "reflect-metadata";
import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

console.log("MONGODB_URI in worker:", process.env.MONGODB_URI);

import { container } from "tsyringe";
import { setupContainerCore, registerCQRS, initCQRS } from "../di/container";
import { DatabaseConfig } from "../config/dbConfig";
import { TrendingWorker } from "../workers/_impl/trending.worker.impl";

const worker = new TrendingWorker();

async function start() {
	try {
		// register core DI entries (models, repos, services, controllers, routes)
		setupContainerCore();

		// register CQRS tokens (handler classes) but do not resolve instances yet
		registerCQRS();

		// connect to DB
		const dbConfig = container.resolve(DatabaseConfig);
		await dbConfig.connect();

		// resolve and wire up CQRS handlers
		initCQRS();

		// init and start the worker
		await worker.init();
		worker.start();

		console.log("Trending worker started");
	} catch (err) {
		console.error("Worker failed to start", err);
		process.exit(1);
	}
}

start();

// graceful shutdown
async function shutdown() {
	console.log("Shutting down trending worker...");
	try {
		await worker.stop?.(); // stop loop, flush pending, close connections
		process.exit(0);
	} catch (err) {
		console.error("Error during shutdown", err);
		process.exit(1);
	}
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
