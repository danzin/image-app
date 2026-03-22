import { NotificationController } from "../controllers/notification.controller";
import { asyncHandler } from "@/middleware/async-handler.middleware";
import express from "express";
import { AuthFactory } from "../middleware/authentication.middleware";
import { inject, injectable } from "tsyringe";
import { TOKENS } from "@/types/tokens";

@injectable()
export class NotificationRoutes {
  public router: express.Router;
  private auth = AuthFactory.bearerToken().handle();

  constructor(
    @inject(TOKENS.Controllers.Notification)
    private controller: NotificationController,
  ) {
    this.router = express.Router();
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    const protectedRouter = express.Router();
    protectedRouter.use(this.auth);
    protectedRouter.get("/", asyncHandler(this.controller.getNotifications)); // supports ?limit=50&skip=0
    protectedRouter.get(
      "/unread-count",
      asyncHandler(this.controller.getUnreadCount),
    );
    protectedRouter.post(
      "/read/:notificationId",
      asyncHandler(this.controller.markAsRead),
    );
    protectedRouter.post(
      "/read-all",
      asyncHandler(this.controller.markAllAsRead),
    );
    this.router.use(protectedRouter);
  }

  getRouter() {
    return this.router;
  }
}
