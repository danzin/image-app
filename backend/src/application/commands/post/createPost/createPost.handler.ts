import { inject, injectable } from "tsyringe";
import * as fs from "fs";
import mongoose, { ClientSession } from "mongoose";
import { v4 as uuidv4 } from "uuid";
import { CreatePostCommand } from "./createPost.command";
import { ICommandHandler } from "../../../common/interfaces/command-handler.interface";
import { IPostReadRepository } from "../../../../repositories/interfaces/IPostReadRepository";
import { IPostWriteRepository } from "../../../../repositories/interfaces/IPostWriteRepository";
import { IUserReadRepository } from "../../../../repositories/interfaces/IUserReadRepository";
import { IUserWriteRepository } from "../../../../repositories/interfaces/IUserWriteRepository";
import { TagService } from "../../../../services/tag.service";
import { ImageService } from "../../../../services/image.service";
import { RedisService } from "../../../../services/redis.service";
import { DTOService } from "../../../../services/dto.service";
import { UnitOfWork } from "../../../../database/UnitOfWork";
import { EventBus } from "../../../common/buses/event.bus";
import { PostUploadedEvent } from "../../../events/post/post.event";
import { PostUploadHandler } from "../../../events/post/post-uploaded.handler";
import { createError } from "../../../../utils/errors";
import { sanitizeForMongo, isValidPublicId, sanitizeTextInput } from "../../../../utils/sanitizers";
import { AttachmentSummary, IPost, PostDTO } from "../../../../types";
import { NotificationService } from "../../../../services/notification.service";
import { PostNotFoundError, UserNotFoundError, mapPostError } from "../../../errors/post.errors";
import { logger } from "../../../../utils/winston";
const MAX_BODY_LENGTH = 300;

@injectable()
export class CreatePostCommandHandler implements ICommandHandler<CreatePostCommand, PostDTO> {
	constructor(
		@inject("UnitOfWork") private readonly unitOfWork: UnitOfWork,
		@inject("PostReadRepository") private readonly postReadRepository: IPostReadRepository,
		@inject("PostWriteRepository") private readonly postWriteRepository: IPostWriteRepository,
		@inject("UserReadRepository") private readonly userReadRepository: IUserReadRepository,
		@inject("UserWriteRepository") private readonly userWriteRepository: IUserWriteRepository,
		@inject("TagService") private readonly tagService: TagService,
		@inject("ImageService") private readonly imageService: ImageService,
		@inject("RedisService") private readonly redisService: RedisService,
		@inject("DTOService") private readonly dtoService: DTOService,
		@inject("EventBus") private readonly eventBus: EventBus,
		@inject("PostUploadHandler") private readonly postUploadHandler: PostUploadHandler,
		@inject("NotificationService") private readonly notificationService: NotificationService
	) {}

	async execute(command: CreatePostCommand): Promise<PostDTO> {
		// validate userPublicId format and user, early exit on fail to release the resource immdeiately
		if (!isValidPublicId(command.userPublicId)) {
			// static validation first, protects the db from malformed requests and spam
			throw createError("ValidationError", "Invalid userPublicId format");
		}
		const user = await this.validateUser(command.userPublicId);

		let uploadedImagePublicId: string | null = null;

		try {
			const result = await this.unitOfWork.executeInTransaction(async (session) => {
				const internalUserId = user._id as mongoose.Types.ObjectId;

				const normalizedBody = this.normalizeBody(command.body);
				const tagNames = this.tagService.collectTagNames(normalizedBody, command.tags);
				const tagDocs = await this.tagService.ensureTagsExist(tagNames, session);
				const tagIds = tagDocs.map((tag) => new mongoose.Types.ObjectId((tag as any)._id));

				if (tagIds.length > 0) {
					await this.tagService.incrementUsage(tagIds, session);
				}

				const imageSummary = await this.handleImageUpload(command, user, internalUserId, session, (publicId) => {
					uploadedImagePublicId = publicId;
				});

				const post = await this.createPost(user, internalUserId, normalizedBody, tagIds, imageSummary, session);
				await this.userWriteRepository.update(user.id, { $inc: { postCount: 1 } }, session);

				// Handle mentions
				const mentionRegex = /@(\w+)/g;
				const mentions = [...normalizedBody.matchAll(mentionRegex)].map((match) => match[1]);

				logger.info(`[CreatePost] Body: "${normalizedBody}"`);
				logger.info(`[CreatePost] Extracted mentions: ${JSON.stringify(mentions)}`);

				if (mentions.length > 0) {
					const uniqueMentions = [...new Set(mentions)];
					const mentionedUsers = await this.userReadRepository.findUsersByUsernames(uniqueMentions);

					logger.info(`[CreatePost] Found users for mentions: ${mentionedUsers.length}`);

					for (const mentionedUser of mentionedUsers) {
						// Filter: Remove post author - no self mention
						if (mentionedUser.publicId === user.publicId) {
							logger.info(`[CreatePost] Skipping self-mention for ${user.username}`);
							continue;
						}

						logger.info(`[CreatePost] Creating notification for ${mentionedUser.username} (${mentionedUser.publicId})`);
						await this.notificationService.createNotification({
							receiverId: mentionedUser.publicId,
							actionType: "mention",
							actorId: user.publicId,
							actorUsername: user.username,
							actorAvatar: user.avatar,
							targetId: post.publicId,
							targetType: "post",
							targetPreview: normalizedBody.substring(0, 50) + (normalizedBody.length > 50 ? "..." : ""),
							session,
						});
					}
				}

				const distinctTags = Array.from(new Set(tagNames));
				this.eventBus.queueTransactional(
					new PostUploadedEvent(post.publicId, user.publicId, distinctTags),
					this.postUploadHandler
				);

				return {
					post,
					user,
					tagNames,
				};
			});

			return await this.finalizePost(result);
		} catch (error) {
			if (uploadedImagePublicId) {
				await this.rollbackImageUpload(uploadedImagePublicId);
			}
			throw mapPostError(error, {
				action: "create-post",
				userPublicId: command.userPublicId,
				imageUploaded: Boolean(uploadedImagePublicId),
			});
		}
	}

	private async validateUser(publicId: string): Promise<any> {
		const user = await this.userReadRepository.findByPublicId(publicId);
		if (!user) {
			throw new UserNotFoundError();
		}
		return user;
	}

	private normalizeBody(body?: string): string {
		if (!body) return "";

		try {
			// sanitize with max length validation
			logger.info("Sanitizing body:", body);
			const sanitized = sanitizeTextInput(body, MAX_BODY_LENGTH);
			return sanitized;
		} catch (error) {
			// if sanitization fails (empty after cleaning), return empty string
			if (error instanceof Error && error.message.includes("empty")) {
				return "";
			}
			// if length exceeded, truncate
			if (error instanceof Error && error.message.includes("exceed")) {
				return sanitizeTextInput(body.slice(0, MAX_BODY_LENGTH), MAX_BODY_LENGTH);
			}
			return "";
		}
	}

	private async handleImageUpload(
		command: CreatePostCommand,
		user: any,
		internalUserId: mongoose.Types.ObjectId,
		session: ClientSession,
		setUploadedId: (publicId: string) => void
	): Promise<AttachmentSummary> {
		if (!command.imagePath) {
			return { docId: null };
		}

		try {
			const { storagePublicId, summary } = await this.imageService.createPostAttachment({
				filePath: command.imagePath,
				originalName: command.imageOriginalName || `post-${Date.now()}`,
				userInternalId: internalUserId.toString(),
				userPublicId: user.publicId,
				session,
			});

			if (storagePublicId) {
				setUploadedId(storagePublicId);
			}

			if (!summary.docId) {
				throw createError("UnknownError", "Image document was not created");
			}

			return summary;
		} finally {
			// Clean up the temporary file
			if (command.imagePath && fs.existsSync(command.imagePath)) {
				fs.unlink(command.imagePath, (err) => {
					if (err) console.error("Failed to delete temp file:", err);
				});
			}
		}
	}

	private async createPost(
		user: any,
		internalUserId: mongoose.Types.ObjectId,
		normalizedBody: string,
		tagIds: mongoose.Types.ObjectId[],
		imageSummary: AttachmentSummary,
		session: ClientSession
	): Promise<IPost> {
		const postSlug = imageSummary.slug ?? this.generatePostSlug(normalizedBody);
		const postPublicId = uuidv4();

		const payload: Partial<IPost> = {
			publicId: postPublicId,
			user: internalUserId,
			author: {
				_id: internalUserId,
				publicId: user.publicId,
				username: user.username,
				avatarUrl: user.avatar ?? user.profile?.avatarUrl ?? "",
				displayName: user.profile?.displayName ?? user.username,
			},
			body: normalizedBody,
			slug: postSlug,
			image: imageSummary.docId,
			tags: tagIds,
			likesCount: 0,
			commentsCount: 0,
		};

		// sanitize payload to prevent NoSQL injection and prototype pollution
		logger.info("Sanitizing post payload:", payload);
		const safePayload = sanitizeForMongo(payload);
		logger.info("Safe post payload:", safePayload);

		return await this.postWriteRepository.create(safePayload as unknown as IPost, session);
	}

	private generatePostSlug(body: string): string {
		const base = body
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/(^-|-$)/g, "")
			.slice(0, 60);
		const safeBase = base || "post";
		return `${safeBase}-${Date.now()}`;
	}

	private async finalizePost(result: { post: IPost; user: any; tagNames: string[] }): Promise<PostDTO> {
		const hydratedPost = await this.postReadRepository.findByPublicId(result.post.publicId);
		if (!hydratedPost) {
			throw new PostNotFoundError("Post not found after creation");
		}

		await this.redisService.invalidateByTags([`user_feed:${result.user.publicId}`]);

		return this.dtoService.toPostDTO(hydratedPost);
	}

	private async rollbackImageUpload(publicId: string): Promise<void> {
		await this.imageService.rollbackUpload(publicId);
	}
}
