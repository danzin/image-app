import { Request, Response } from "express";
import { NotificationService } from "@/services/notification.service";
import { Errors } from "@/utils/errors";
import { streamCursorResponse } from "@/utils/streamResponse";
import { inject, injectable } from "tsyringe";
import { logger } from "@/utils/winston";
import { TOKENS } from "@/types/tokens";

/** Threshold for enabling streaming responses (items) */
const STREAM_THRESHOLD = 100;

@injectable()
export class NotificationController {
  constructor(
    @inject(TOKENS.Services.Notification)
    private readonly notificationService: NotificationService,
  ) {}

  getNotifications = async (req: Request, res: Response) => {
    const { decodedUser } = req;
    if (!decodedUser || !decodedUser.publicId) {
      throw Errors.validation("User publicId is required");
    }
    const userPublicId = decodedUser.publicId;

    // cursor-based pagination support
    const beforeStr = req.query.before as string | undefined;
    const before = beforeStr ? new Date(beforeStr).getTime() : undefined;
    const limit = parseInt(req.query.limit as string) || 20;

    // validate pagination params
    if (limit < 1 || limit > 100) {
      throw Errors.validation("Limit must be between 1 and 100");
    }

    if (before !== undefined && (isNaN(before) || before < 0)) {
      throw Errors.validation("Invalid 'before' timestamp");
    }

    const notifications = await this.notificationService.getNotifications(
      userPublicId,
      limit,
      before,
    );

    logger.info(
      `[NOTIFICATIONS] Fetched ${notifications.length} notifications for user: ${userPublicId}` +
        (before
          ? ` (before: ${new Date(before).toISOString()})`
          : " (initial load)"),
    );

    // Determine if there are more notifications (heuristic: if we got exactly limit, there may be more)
    const hasMore = notifications.length === limit;
    // Generate next cursor from the oldest notification's createdAt
    const nextCursor =
      hasMore && notifications.length > 0
        ? new Date(
            (notifications[notifications.length - 1] as any).timestamp,
          ).toISOString()
        : undefined;

    if (notifications.length >= STREAM_THRESHOLD) {
      streamCursorResponse(res, notifications, {
        hasMore,
        nextCursor,
      });
    } else {
      res.status(200).json({
        data: notifications,
        hasMore,
        nextCursor,
      });
    }
  };

  markAsRead = async (req: Request, res: Response) => {
    const { notificationId } = req.params;
    const { decodedUser } = req;
    if (!decodedUser || !decodedUser.publicId) {
      throw Errors.validation("User publicId is required");
    }
    const userPublicId = decodedUser.publicId;
    const notification = await this.notificationService.markAsRead(
      notificationId,
      userPublicId,
    );
    res.status(200).json(notification);
  };

  getUnreadCount = async (req: Request, res: Response) => {
    const { decodedUser } = req;
    if (!decodedUser || !decodedUser.publicId) {
      throw Errors.validation("User publicId is required");
    }
    const userPublicId = decodedUser.publicId;
    const count = await this.notificationService.getUnreadCount(userPublicId);
    res.status(200).json({ count });
  };

  markAllAsRead = async (req: Request, res: Response) => {
    const { decodedUser } = req;
    if (!decodedUser || !decodedUser.publicId) {
      throw Errors.validation("User publicId is required");
    }
    const userPublicId = decodedUser.publicId;
    const modifiedCount =
      await this.notificationService.markAllAsRead(userPublicId);
    res.status(200).json({ modifiedCount });
  };
}
