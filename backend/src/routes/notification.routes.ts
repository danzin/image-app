import { NotificationController } from "../controllers/notification.controller";
import express from "express";
import { AuthFactory } from "../middleware/authentication.middleware";
import { inject, injectable } from "tsyringe";

@injectable()
export class NotificationRoutes {
	public router: express.Router;
	private auth = AuthFactory.bearerToken().handle();

	constructor(@inject("NotificationController") private controller: NotificationController) {
		this.router = express.Router();
		this.initializeRoutes();
	}

	private initializeRoutes(): void {
		const protectedRouter = express.Router();
		protectedRouter.use(this.auth);
		protectedRouter.get("/", this.controller.getNotifications);
		protectedRouter.post("/read/:notificationId", this.controller.markAsRead);
		this.router.use(protectedRouter);
	}

	getRouter() {
		return this.router;
	}
}
