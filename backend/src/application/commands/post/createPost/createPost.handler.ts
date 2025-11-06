import { inject, injectable } from "tsyringe";
import mongoose, { ClientSession } from "mongoose";
import { v4 as uuidv4 } from "uuid";
import { CreatePostCommand } from "./createPost.command";
import { ICommandHandler } from "../../../common/interfaces/command-handler.interface";
import { PostRepository } from "../../../../repositories/post.repository";
import { UserRepository } from "../../../../repositories/user.repository";
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

const MAX_BODY_LENGTH = 300;

@injectable()
export class CreatePostCommandHandler implements ICommandHandler<CreatePostCommand, PostDTO> {
	constructor(
		@inject("UnitOfWork") private readonly unitOfWork: UnitOfWork,
		@inject("PostRepository") private readonly postRepository: PostRepository,
		@inject("UserRepository") private readonly userRepository: UserRepository,
		@inject("TagService") private readonly tagService: TagService,
		@inject("ImageService") private readonly imageService: ImageService,
		@inject("RedisService") private readonly redisService: RedisService,
		@inject("DTOService") private readonly dtoService: DTOService,
		@inject("EventBus") private readonly eventBus: EventBus,
		@inject("PostUploadHandler") private readonly postUploadHandler: PostUploadHandler
	) {}

	async execute(command: CreatePostCommand): Promise<PostDTO> {
		// validate userPublicId format
		if (!isValidPublicId(command.userPublicId)) {
			throw createError("ValidationError", "Invalid userPublicId format");
		}

		let uploadedImagePublicId: string | null = null;

		try {
			const result = await this.unitOfWork.executeInTransaction(async (session) => {
				const user = await this.validateUser(command.userPublicId, session);
				const internalUserId = user._id as mongoose.Types.ObjectId;

				const normalizedBody = this.normalizeBody(command.body);
				const tagNames = this.tagService.collectTagNames(normalizedBody, command.tags);
				const tagDocs = await this.tagService.ensureTagsExist(tagNames, session);
				const tagIds = tagDocs.map((tag) => new mongoose.Types.ObjectId((tag as any)._id));

				const imageSummary = await this.handleImageUpload(
					command,
					user,
					internalUserId,
					tagIds,
					session,
					(publicId) => {
						uploadedImagePublicId = publicId;
					}
				);

				const post = await this.createPost(user, internalUserId, normalizedBody, tagIds, imageSummary, session);

				// queue event inside transaction
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
			throw this.handleError(error);
		}
	}

	private async validateUser(publicId: string, session: ClientSession): Promise<any> {
		const user = await this.userRepository.findByPublicId(publicId, session);
		if (!user) {
			throw createError("NotFoundError", "User not found");
		}
		return user;
	}

	private normalizeBody(body?: string): string {
		if (!body) return "";

		try {
			// sanitize with max length validation
			console.log("Sanitizing body:", body);
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
		tagIds: mongoose.Types.ObjectId[],
		session: ClientSession,
		setUploadedId: (publicId: string) => void
	): Promise<AttachmentSummary> {
		if (!command.imageBuffer) {
			if (tagIds.length > 0) {
				await this.tagService.incrementUsage(tagIds, session);
			}
			return { docId: null };
		}

		const { storagePublicId, summary } = await this.imageService.createPostAttachment({
			buffer: command.imageBuffer,
			originalName: command.imageOriginalName || `post-${Date.now()}`,
			userInternalId: internalUserId.toString(),
			userPublicId: user.publicId,
			tagIds,
			session,
		});

		if (storagePublicId) {
			setUploadedId(storagePublicId);
		}

		if (!summary.docId) {
			throw createError("UnknownError", "Image document was not created");
		}

		return summary;
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
			body: normalizedBody,
			slug: postSlug,
			image: imageSummary.docId,
			tags: tagIds,
			likesCount: 0,
			commentsCount: 0,
		};

		// sanitize payload to prevent NoSQL injection and prototype pollution
		console.log("Sanitizing post payload:", payload);
		const safePayload = sanitizeForMongo(payload);
		console.log("Safe post payload:", safePayload);

		return await this.postRepository.create(safePayload as unknown as IPost, session);
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
		const hydratedPost = await this.postRepository.findByPublicId(result.post.publicId);
		if (!hydratedPost) {
			throw createError("NotFoundError", "Post not found after creation");
		}

		await this.redisService.invalidateByTags([`user_feed:${result.user.publicId}`]);

		return this.dtoService.toPostDTO(hydratedPost);
	}

	private async rollbackImageUpload(publicId: string): Promise<void> {
		await this.imageService.rollbackUpload(publicId);
	}

	private handleError(error: unknown): never {
		if (error instanceof Error) {
			throw createError(error.name, error.message, {
				function: "CreatePostCommand",
				file: "createPost.handler.ts",
			});
		}
		throw createError("UnknownError", String(error), {
			function: "CreatePostCommand",
			file: "createPost.handler.ts",
		});
	}
}
