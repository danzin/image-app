import "reflect-metadata";
import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import { container } from "tsyringe";
import { setupContainerCore, registerCQRS, initCQRS } from "../di/container";
import { DatabaseConfig } from "../config/dbConfig";
import { ProfileSyncWorker } from "./_impl/profile-sync.worker.impl";

const worker = new ProfileSyncWorker();

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
		await worker.start();

		console.log("Profile sync worker started");
	} catch (err) {
		console.error("Profile sync worker failed to start", err);
		process.exit(1);
	}
}

start();

// graceful shutdown
async function shutdown() {
	console.log("Shutting down profile sync worker...");
	try {
		await worker.stop();
		process.exit(0);
	} catch (err) {
		console.error("Error during shutdown", err);
		process.exit(1);
	}
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
