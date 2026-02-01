import { inject, injectable } from "tsyringe";
import { IEventHandler } from "@/application/common/interfaces/event-handler.interface";
import { NotificationRequestedEvent } from "@/application/events/notification/notification.event";
import { NotificationService } from "@/services/notification.service";
import { logger } from "@/utils/winston";

@injectable()
export class NotificationRequestedHandler implements IEventHandler<NotificationRequestedEvent> {
	constructor(@inject("NotificationService") private readonly notificationService: NotificationService) {}

	async handle(event: NotificationRequestedEvent): Promise<void> {
		try {
			await this.notificationService.createNotification(event.payload);
		} catch (error) {
			logger.error("[NotificationRequestedHandler] Failed to create notification", { error });
		}
	}
}
