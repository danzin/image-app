import { injectable } from "tsyringe";
import { IEventHandler } from "@/application/common/interfaces/event-handler.interface";
import { MessageAttachmentsDeletedEvent } from "@/application/events/message/message.event";
import { logger } from "@/utils/winston";

@injectable()
export class MessageAttachmentsDeletedHandler implements IEventHandler<MessageAttachmentsDeletedEvent> {
  async handle(event: MessageAttachmentsDeletedEvent): Promise<void> {
    const { attachmentPublicIds } = event;

    if (!attachmentPublicIds || attachmentPublicIds.length === 0) {
      return;
    }

    logger.warn("Skipped unsafe legacy message attachment cleanup", {
      event: "messaging.attachment_cleanup.skipped",
      attachmentCount: attachmentPublicIds.length,
    });
  }
}
