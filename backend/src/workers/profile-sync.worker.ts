import "reflect-metadata";
import path from "path";
import dotenv from "dotenv";
import { logger } from "@/utils/winston";
import dns from 'node:dns';
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import { container } from "tsyringe";
import { setupContainerCore, registerCQRS, initCQRS } from "@/di/container";
import { DatabaseConfig } from "@/config/dbConfig";
import { ProfileSyncWorker } from "./_impl/profile-sync.worker.impl";

const worker = new ProfileSyncWorker();
dns.setServers(['8.8.8.8', '1.1.1.1']);

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

		logger.info("Profile sync worker started");
	} catch (err) {
		logger.error("Profile sync worker failed to start", { error: err });
		process.exit(1);
	}
}

start();

// graceful shutdown
async function shutdown() {
	logger.info("Shutting down profile sync worker...");
	try {
		await worker.stop();
		process.exit(0);
	} catch (err) {
		logger.error("Error during shutdown", { error: err });
		process.exit(1);
	}
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
