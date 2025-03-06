import { ICommandHandler } from "../../../../application/common/interfaces/command-handler.interface";
import { inject, injectable } from "tsyringe";
import { LikeActionCommand } from "./likeAction.command";
import { IImage } from "../../../../types/index";
import { EventBus } from "../../../../application/common/buses/event.bus";
import { UserInteractedWithImageEvent } from "../../../../application/events/user/user-interaction.event";
import { ImageRepository } from "../../../../repositories/image.repository";
import { LikeRepository } from "../../../../repositories/like.repository";
import { UserActionRepository } from "../../../../repositories/userAction.repository";
import { NotificationService } from "../../../../services/notification.service";
import { createError } from "../../../../utils/errors";
import { FeedInteractionHandler } from "../../../../application/events/feed/feed-interaction.handler";
import { ClientSession } from "mongoose";
import { convertToObjectId } from "../../../../utils/helpers";
import { UnitOfWork } from "../../../../database/UnitOfWork";

@injectable()
export class LikeActionCommandHandler 
  implements ICommandHandler<LikeActionCommand, IImage> {

  constructor(
    @inject('UnitOfWork') private readonly unitOfWork: UnitOfWork,
    @inject('ImageRepository') private readonly imageRepository: ImageRepository,
    @inject('LikeRepository') private readonly likeRepository: LikeRepository,
    @inject('UserActionRepository') private readonly userActionRepository: UserActionRepository,
    @inject('NotificationService') private readonly notificationService: NotificationService,
    @inject('EventBus') private readonly eventBus: EventBus,
    @inject('FeedInteractionHandler') private readonly feedInteractionHandler: FeedInteractionHandler
  ) {}

  async execute(command: LikeActionCommand): Promise<IImage> {
    let isLikeAction = true;
    let imageTags: string[] = [];
    let existingImage: IImage;

    try {
      existingImage = await this.imageRepository.findById(command.imageId);
      if (!existingImage) {
        throw createError('PathError', `Image ${command.imageId} not found`);
      }
      imageTags = existingImage.tags.map(t => t.tag);

      await this.unitOfWork.executeInTransaction(async (session) => {
        const existingLike = await this.likeRepository.findByUserAndImage(
          command.userId, 
          command.imageId, 
          session
        );

        if (existingLike) {
          await this.handleUnlike(command, session);
          isLikeAction = false;
        } else {
          await this.handleLike(command, existingImage, session);
        }

        this.eventBus.queueTransactional(
          new UserInteractedWithImageEvent(
            command.userId,
            isLikeAction ? 'like' : 'unlike',
            command.imageId,
            imageTags
          ),
          this.feedInteractionHandler
        );
      });

      return this.imageRepository.findById(command.imageId);

    } catch (error) {
      console.error(error);
      throw createError(error.name, error.message, {
        operation: 'LikeAction',
        userId: command.userId,
        imageId: command.imageId
      });
    }
  }

  private async handleLike(
    command: LikeActionCommand,
    image: IImage,
    session: ClientSession
  ) {
    await this.likeRepository.create({
      userId: convertToObjectId(command.userId),
      imageId: convertToObjectId(command.imageId)
    }, session);

    await this.imageRepository.findOneAndUpdate(
      { _id: command.imageId },
      { $inc: { likes: 1 } },
      session
    );

    await this.userActionRepository.logAction(
      command.userId,
      "like",
      command.imageId,
      session
    );

    await this.notificationService.createNotification({
      receiverId: image.user.id.toString(),
      actionType: "like",
      actorId: command.userId,
      targetId: command.imageId,
      session
    });
  }

  private async handleUnlike(
    command: LikeActionCommand,
    session: ClientSession
  ) {
    await this.likeRepository.deleteLike(
      command.userId, 
      command.imageId, 
      session
    );

    await this.imageRepository.findOneAndUpdate(
      { _id: command.imageId },
      { $inc: { likes: -1 } },
      session
    );

    await this.userActionRepository.logAction(
      command.userId,
      "unlike",
      command.imageId,
      session
    );
  }
}