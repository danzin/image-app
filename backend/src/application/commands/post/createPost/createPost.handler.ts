import { inject, injectable } from "tsyringe";
import * as fs from "fs";
import mongoose, { ClientSession, Types } from "mongoose";
import { v4 as uuidv4 } from "uuid";
import { CreatePostCommand } from "./createPost.command";
import { ICommandHandler } from "@/application/common/interfaces/command-handler.interface";
import { IPostReadRepository } from "@/repositories/interfaces/IPostReadRepository";
import { IPostWriteRepository } from "@/repositories/interfaces/IPostWriteRepository";
import { IUserReadRepository } from "@/repositories/interfaces/IUserReadRepository";
import { IUserWriteRepository } from "@/repositories/interfaces/IUserWriteRepository";
import { CommunityRepository } from "@/repositories/community.repository";
import { CommunityMemberRepository } from "@/repositories/communityMember.repository";
import { TagService } from "@/services/tag.service";
import { ImageService } from "@/services/image.service";
import { RedisService } from "@/services/redis.service";
import { DTOService } from "@/services/dto.service";
import { UnitOfWork } from "@/database/UnitOfWork";
import { EventBus } from "@/application/common/buses/event.bus";
import { PostUploadedEvent } from "@/application/events/post/post.event";
import { PostUploadHandler } from "@/application/events/post/post-uploaded.handler";
import { createError } from "@/utils/errors";
import { sanitizeForMongo, isValidPublicId, sanitizeTextInput } from "@/utils/sanitizers";
import { generateSlug } from "@/utils/helpers";
import { AttachmentSummary, IPost, IUser, PostDTO } from "@/types";
import { NotificationRequestedEvent } from "@/application/events/notification/notification.event";
import { NotificationRequestedHandler } from "@/application/events/notification/notification-requested.handler";
import { PostNotFoundError, UserNotFoundError, mapPostError } from "../../../errors/post.errors";
import { logger } from "@/utils/winston";
import { CacheKeyBuilder } from "@/utils/cache/CacheKeyBuilder";
import { TOKENS } from "@/types/tokens";
const MAX_BODY_LENGTH = 300;

@injectable()
export class CreatePostCommandHandler implements ICommandHandler<CreatePostCommand, PostDTO> {
	constructor(
		@inject(TOKENS.Repositories.UnitOfWork) private readonly unitOfWork: UnitOfWork,
		@inject(TOKENS.Repositories.PostRead) private readonly postReadRepository: IPostReadRepository,
		@inject(TOKENS.Repositories.PostWrite) private readonly postWriteRepository: IPostWriteRepository,
		@inject(TOKENS.Repositories.UserRead) private readonly userReadRepository: IUserReadRepository,
		@inject(TOKENS.Repositories.UserWrite) private readonly userWriteRepository: IUserWriteRepository,
		@inject(TOKENS.Repositories.Community) private readonly communityRepository: CommunityRepository,
		@inject(TOKENS.Repositories.CommunityMember) private readonly communityMemberRepository: CommunityMemberRepository,
		@inject(TOKENS.Services.Tag) private readonly tagService: TagService,
		@inject(TOKENS.Services.Image) private readonly imageService: ImageService,
		@inject(TOKENS.Services.Redis) private readonly redisService: RedisService,
		@inject(TOKENS.Services.DTO) private readonly dtoService: DTOService,
		@inject(TOKENS.CQRS.Handlers.EventBus) private readonly eventBus: EventBus,
		@inject(TOKENS.CQRS.Handlers.PostUpload) private readonly postUploadHandler: PostUploadHandler,
		@inject(TOKENS.CQRS.Handlers.NotificationRequested)
		private readonly notificationRequestedHandler: NotificationRequestedHandler,
	) {}

	async execute(command: CreatePostCommand): Promise<PostDTO> {
		// validate userPublicId format and user, early exit on fail to release the resource immdeiately
		if (!isValidPublicId(command.userPublicId)) {
			// static validation first, protects the db from malformed requests and spam
			throw createError("ValidationError", "Invalid userPublicId format");
		}
		const user = await this.validateUser(command.userPublicId);

		// validate community membership if posting to a community
		let communityInternalId: Types.ObjectId | null = null;
		if (command.communityPublicId) {
			if (!isValidPublicId(command.communityPublicId)) {
				throw createError("ValidationError", "Invalid communityPublicId format");
			}
			const communityValidation = await this.validateCommunityMembership(
				command.communityPublicId,
				user._id as Types.ObjectId,
			);
			communityInternalId = communityValidation.communityId;
		}

		let uploadedImagePublicId: string | null = null;
		let uploadedImageUrl: string | null = null;

		// Upload Image outside transaction - prefer streaming from buffer
		const hasImage = command.imageBuffer || command.imagePath;
		if (hasImage) {
			try {
				let uploadResult: { url: string; publicId: string };
				
				if (command.imageBuffer) {
					// Use streaming upload from memory buffer (preferred)
					uploadResult = await this.imageService.uploadImageStream(
						{
							buffer: command.imageBuffer,
							originalName: command.imageOriginalName,
							mimeType: command.imageMimeType,
						},
						user.publicId,
					);
				} else if (command.imagePath) {
					// Fallback to file path upload (legacy)
					uploadResult = await this.imageService.uploadImage(command.imagePath, user.publicId);
				} else {
					throw createError("ValidationError", "No image data provided");
				}
				
				uploadedImagePublicId = uploadResult.publicId;
				uploadedImageUrl = uploadResult.url;
			} catch (error) {
				throw mapPostError(error, {
					action: "upload-image",
					userPublicId: command.userPublicId,
					imageUploaded: false,
				});
			}
		}

		try {
			const result = await this.unitOfWork.executeInTransaction(async (session) => {
				const internalUserId = user._id as mongoose.Types.ObjectId;

				const normalizedBody = this.normalizeBody(command.body);
				const tagNames = this.tagService.collectTagNames(normalizedBody, command.tags);
				const tagDocs = await this.tagService.ensureTagsExist(tagNames, session);
				const tagIds = tagDocs.map((tag) => new mongoose.Types.ObjectId(tag._id));

				if (tagIds.length > 0) {
					await this.tagService.incrementUsage(tagIds, session);
				}

				const imageSummary = await this.handleImageCreation(
					command,
					internalUserId,
					uploadedImageUrl,
					uploadedImagePublicId,
					session,
				);

				const post = await this.createPost(
					user,
					internalUserId,
					normalizedBody,
					tagIds,
					imageSummary,
					session,
					communityInternalId,
				);

				// increment user post count only for personal posts
				if (!communityInternalId) {
					await this.userWriteRepository.update(user.id, { $inc: { postCount: 1 } }, session);
				} else {
					// increment community post count
					await this.communityRepository.findOneAndUpdate(
						{ _id: communityInternalId },
						{ $inc: { "stats.postCount": 1 } },
						session,
					);
				}

				// Handle mentions
				const mentionRegex = /@([a-zA-Z0-9._]+)/g;
				const mentions = [...normalizedBody.matchAll(mentionRegex)].map((match) => match[1]);

				if (mentions.length > 0) {
					const uniqueMentions = [...new Set(mentions)];
					const mentionedUsers = await this.userReadRepository.findUsersByHandles(uniqueMentions);

					for (const mentionedUser of mentionedUsers) {
						// Filter: Remove post author - no self mention
						if (mentionedUser.publicId === user.publicId) {
							logger.info(`[CreatePost] Skipping self-mention for ${user.username}`);
							continue;
						}

						this.eventBus.queueTransactional(
							new NotificationRequestedEvent({
								receiverId: mentionedUser.publicId,
								actionType: "mention",
								actorId: user.publicId,
								actorUsername: user.username,
								actorHandle: user.handle,
								actorAvatar: user.avatar,
								targetId: post.publicId,
								targetType: "post",
								targetPreview: command.body
									? command.body.substring(0, 50) + (command.body.length > 50 ? "..." : "")
									: "",
							}),
							this.notificationRequestedHandler,
						);
					}
				}

				const distinctTags = Array.from(new Set(tagNames));
				this.eventBus.queueTransactional(
					new PostUploadedEvent(post.publicId, user.publicId, distinctTags),
					this.postUploadHandler,
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
		} finally {
			// Clean up temp file if using legacy file path upload
			if (command.imagePath && fs.existsSync(command.imagePath)) {
				fs.unlink(command.imagePath, (err) => {
					if (err) logger.error("Failed to delete temp file", { error: err });
				});
			}
		}
	}

	private async validateUser(publicId: string): Promise<IUser> {
		const user = await this.userReadRepository.findByPublicId(publicId);
		if (!user) {
			throw new UserNotFoundError();
		}
		return user;
	}

	private async validateCommunityMembership(
		communityPublicId: string,
		userId: Types.ObjectId,
	): Promise<{ communityId: Types.ObjectId }> {
		const community = await this.communityRepository.findByPublicId(communityPublicId);
		if (!community) {
			throw createError("NotFoundError", "Community not found");
		}

		const communityId = community._id as Types.ObjectId;
		const membership = await this.communityMemberRepository.findByCommunityAndUser(communityId, userId);

		if (!membership) {
			throw createError("ForbiddenError", "You must be a member of the community to post");
		}

		return { communityId };
	}

	private normalizeBody(body?: string): string {
		if (!body) return "";

		try {
			// sanitize with max length validation
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

	private async handleImageCreation(
		command: CreatePostCommand,
		internalUserId: mongoose.Types.ObjectId,
		uploadedUrl: string | null,
		uploadedPublicId: string | null,
		session: ClientSession,
	): Promise<AttachmentSummary> {
		if (!uploadedUrl || !uploadedPublicId) {
			return { docId: null };
		}

		const { summary } = await this.imageService.createImageRecord({
			url: uploadedUrl,
			storagePublicId: uploadedPublicId,
			originalName: command.imageOriginalName || `post-${Date.now()}`,
			userInternalId: internalUserId.toString(),
			session,
		});

		if (!summary.docId) {
			throw createError("UnknownError", "Image document was not created");
		}

		return summary;
	}

	private async createPost(
		user: IUser,
		internalUserId: mongoose.Types.ObjectId,
		normalizedBody: string,
		tagIds: mongoose.Types.ObjectId[],
		imageSummary: AttachmentSummary,
		session: ClientSession,
		communityId: Types.ObjectId | null = null,
	): Promise<IPost> {
		const postSlug = imageSummary.slug ?? `${generateSlug(normalizedBody, 60) || "post"}-${Date.now()}`;
		const postPublicId = uuidv4();

				const payload: Partial<IPost> = {
					publicId: postPublicId,
					user: internalUserId,
					author: {
						_id: internalUserId,
						publicId: user.publicId,
						handle: user.handle,
						username: user.username,
						avatarUrl: user.avatar ?? "",
						displayName: user.username,
					},
			body: normalizedBody,
			slug: postSlug,
			image: imageSummary.docId,
			tags: tagIds,
			likesCount: 0,
			commentsCount: 0,
		};

		// add communityId if this is a community post
		if (communityId) {
			payload.communityId = communityId;
		}

		// sanitize payload to prevent NoSQL injection and prototype pollution
		const safePayload = sanitizeForMongo(payload);

		return await this.postWriteRepository.create(safePayload as unknown as IPost, session);
	}

	private async finalizePost(result: { post: IPost; user: IUser; tagNames: string[] }): Promise<PostDTO> {
		const hydratedPost = await this.postReadRepository.findByPublicId(result.post.publicId);
		if (!hydratedPost) {
			throw new PostNotFoundError("Post not found after creation");
		}

		await this.redisService.invalidateByTags([CacheKeyBuilder.getUserFeedTag(result.user.publicId)]);

		return this.dtoService.toPostDTO(hydratedPost);
	}

	private async rollbackImageUpload(publicId: string): Promise<void> {
		await this.imageService.rollbackUpload(publicId);
	}
}
