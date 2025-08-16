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
		this.router.use(protectedRouter);
		protectedRouter.use(this.auth);

		this.router.get("/", this.controller.getNotifications);
		this.router.post("/read/:notificationId", this.auth, this.controller.markAsRead);
	}

	getRouter() {
		return this.router;
	}
}
