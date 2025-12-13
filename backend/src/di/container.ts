import "reflect-metadata";
import { container } from "tsyringe";

import { registerCoreComponents } from "./core.di";
import { registerRepositories } from "./repositories.di";
import { registerServices } from "./services.di";
import { registerControllers } from "./controllers.di";
import { registerRoutes } from "./routes.di";
import { registerCQRS, initCQRS } from "./handlers.di";
import { Server } from "../server/server";

export function setupContainerCore(): void {
	registerCoreComponents();
	registerRepositories();
	registerServices();
	registerControllers();
	registerRoutes();

	container.registerSingleton("Server", Server);
}

export { registerCQRS, initCQRS };
