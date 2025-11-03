import { describe, beforeEach, afterEach, it } from "mocha";
import * as chai from "chai";
import { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import sinon, { SinonStub } from "sinon";
import { ClientSession, Types } from "mongoose";
import { CreatePostCommand } from "../../../application/commands/post/createPost/createPost.command";
import { CreatePostCommandHandler } from "../../../application/commands/post/createPost/createPost.handler";

chai.use(chaiAsPromised);

describe("CreatePostCommandHandler", () => {
	let handler: CreatePostCommandHandler;
	let command: CreatePostCommand;
	let mockUnitOfWork: {
		executeInTransaction: SinonStub;
	};
	let mockPostRepository: {
		create: SinonStub;
		findByPublicId: SinonStub;
	};
	let mockImageRepository: {
		findByPublicId: SinonStub;
	};
	let mockUserRepository: {
		findByPublicId: SinonStub;
	};
	let mockTagService: {
		ensureTagsExist: SinonStub;
		incrementUsage: SinonStub;
		collectTagNames: SinonStub;
	};
	let mockImageService: {
		createPostAttachment: SinonStub;
		deleteImage: SinonStub;
		rollbackUpload: SinonStub;
	};
	let mockRedisService: {
		invalidateFeed: SinonStub;
		invalidateByTags: SinonStub;
	};
	let mockEventBus: {
		queueTransactional: SinonStub;
		publish: SinonStub;
	};
	let mockPostUploadHandler: {
		handle: SinonStub;
	};
	let mockSession: ClientSession;
	let mockDTOService: {
		toPostDTO: SinonStub;
	};

	beforeEach(() => {
		mockUnitOfWork = {
			executeInTransaction: sinon.stub(),
		};

		mockPostRepository = {
			create: sinon.stub(),
			findByPublicId: sinon.stub(),
		};

		mockImageRepository = {
			findByPublicId: sinon.stub(),
		};

		mockUserRepository = {
			findByPublicId: sinon.stub(),
		};

		mockTagService = {
			ensureTagsExist: sinon.stub(),
			incrementUsage: sinon.stub(),
			collectTagNames: sinon.stub(),
		};

		mockImageService = {
			createPostAttachment: sinon.stub(),
			deleteImage: sinon.stub(),
			rollbackUpload: sinon.stub(),
		};

		mockRedisService = {
			invalidateFeed: sinon.stub(),
			invalidateByTags: sinon.stub(),
		};

		mockEventBus = {
			queueTransactional: sinon.stub(),
			publish: sinon.stub(),
		};

		mockPostUploadHandler = {
			handle: sinon.stub(),
		};

		mockDTOService = {
			toPostDTO: sinon.stub(),
		};

		mockSession = {} as ClientSession;

		handler = new CreatePostCommandHandler(
			mockUnitOfWork as any,
			mockPostRepository as any,
			mockUserRepository as any,
			mockTagService as any,
			mockImageService as any,
			mockRedisService as any,
			mockDTOService as any,
			mockEventBus as any,
			mockPostUploadHandler as any
		);

		const imageBuffer = Buffer.from("fake-image-data");
		command = new CreatePostCommand(
			"user-123",
			"Beautiful sunset at the beach #sunset #beach",
			["nature"],
			imageBuffer,
			"sunset.jpg"
		);
	});

	afterEach(() => {
		sinon.restore();
	});

	describe("Command Creation", () => {
		it("should create command with correct properties", () => {
			expect(command.userPublicId).to.equal("user-123");
			expect(command.body).to.equal("Beautiful sunset at the beach #sunset #beach");
			expect(command.tags).to.deep.equal(["nature"]);
			expect(command.imageBuffer).to.be.instanceOf(Buffer);
			expect(command.imageOriginalName).to.equal("sunset.jpg");
			expect(command.type).to.equal("CreatePostCommand");
		});
	});

	describe("Execute Method", () => {
		it("should throw error when user not found", async () => {
			mockUserRepository.findByPublicId.resolves(null);

			mockUnitOfWork.executeInTransaction.callsFake(async (callback) => {
				return await callback(mockSession);
			});

			await expect(handler.execute(command)).to.be.rejectedWith("User not found");
		});

		it("should create post successfully with image and tags", async () => {
			const mockUser = {
				_id: new Types.ObjectId(),
				publicId: "user-123",
			};

			const mockTagIds = [new Types.ObjectId(), new Types.ObjectId(), new Types.ObjectId()];
			const mockTagDocs = mockTagIds.map((id) => ({ _id: id, tag: "nature" }));

			const mockImageDocId = new Types.ObjectId();
			const mockImageResponse = {
				storagePublicId: "cloudinary-id-123",
				summary: {
					docId: mockImageDocId,
					publicId: "img-456",
					url: "/uploads/img-456.jpg",
					slug: "sunset-beach-1234",
				},
			};

			const mockCreatedPost = {
				_id: new Types.ObjectId(),
				publicId: "post-789",
				body: "Beautiful sunset at the beach #sunset #beach",
				user: mockUser._id,
				image: mockImageDocId,
				tags: mockTagIds,
				slug: "sunset-beach-1234",
				likesCount: 0,
				commentsCount: 0,
			};

			const mockHydratedPost = {
				...mockCreatedPost,
				image: {
					_id: mockImageDocId,
					publicId: "img-456",
					url: "/uploads/img-456.jpg",
				},
				tags: mockTagDocs,
			};

			mockUserRepository.findByPublicId.resolves(mockUser);
			mockTagService.collectTagNames.returns(["sunset", "beach", "nature"]);
			mockTagService.ensureTagsExist.resolves(mockTagDocs);
			mockImageService.createPostAttachment.resolves(mockImageResponse);
			mockPostRepository.create.resolves(mockCreatedPost);
			mockPostRepository.findByPublicId.resolves(mockHydratedPost);

			mockUnitOfWork.executeInTransaction.callsFake(async (callback) => {
				return await callback(mockSession);
			});

			const result = await handler.execute(command);

			expect(mockUserRepository.findByPublicId.calledWith("user-123")).to.be.true;
			expect(mockTagService.collectTagNames.called).to.be.true;
			expect(mockTagService.ensureTagsExist.called).to.be.true;
			expect(mockImageService.createPostAttachment.called).to.be.true;
			expect(mockPostRepository.create.called).to.be.true;
			expect(mockUnitOfWork.executeInTransaction.called).to.be.true;
			expect(result).to.have.property("publicId");
		});

		it("should queue PostUploadedEvent after successful creation", async () => {
			const mockUser = {
				_id: new Types.ObjectId(),
				publicId: "user-123",
			};

			const mockTagIds = [new Types.ObjectId()];
			const mockTagDocs = mockTagIds.map((id) => ({ _id: id, tag: "nature" }));

			const docId = new Types.ObjectId();
			const publicId = "img-456";
			const url = "/uploads/img-456.jpg";
			const slug = "sunset-1234";

			const mockImageSummary = {
				storagePublicId: "cloudinary-id-123",
				summary: { docId, publicId, url, slug },
			};

			const mockCreatedPost = {
				_id: new Types.ObjectId(),
				publicId: "post-789",
				body: "Beautiful sunset",
				user: mockUser._id,
				image: docId,
				tags: mockTagIds,
				slug: "sunset-1234",
				likesCount: 0,
				commentsCount: 0,
			};

			const mockHydratedPost = {
				...mockCreatedPost,
				image: {
					_id: docId,
					publicId,
					url,
				},
				tags: mockTagDocs,
			};

			mockUserRepository.findByPublicId.resolves(mockUser);
			mockTagService.collectTagNames.returns(["nature"]);
			mockTagService.ensureTagsExist.resolves(mockTagDocs);
			mockImageService.createPostAttachment.resolves(mockImageSummary);
			mockPostRepository.create.resolves(mockCreatedPost);
			mockPostRepository.findByPublicId.resolves(mockHydratedPost);

			mockUnitOfWork.executeInTransaction.callsFake(async (callback) => {
				return await callback(mockSession);
			});

			await handler.execute(command);

			expect(mockEventBus.queueTransactional.calledOnce).to.be.true;
		});
	});
});
