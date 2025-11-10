import { describe, beforeEach, afterEach, it } from "mocha";
import * as chai from "chai";
import { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import sinon, { SinonStub } from "sinon";
import { ClientSession, Types } from "mongoose";
import { LikeActionByPublicIdCommand } from "../../../../application/commands/users/likeActionByPublicId/likeActionByPublicId.command";
import { LikeActionByPublicIdCommandHandler } from "../../../../application/commands/users/likeActionByPublicId/likeActionByPublicId.handler";
import { IPost } from "../../../../types";

chai.use(chaiAsPromised);

describe("LikeActionByPublicIdCommandHandler", () => {
	let handler: LikeActionByPublicIdCommandHandler;
	let command: LikeActionByPublicIdCommand;
	let mockUnitOfWork: {
		executeInTransaction: SinonStub;
	};
	let mockPostRepository: {
		findByPublicId: SinonStub;
		hasUserLiked: SinonStub;
		addLike: SinonStub;
		removeLike: SinonStub;
	};
	let mockUserRepository: {
		findByPublicId: SinonStub;
	};
	let mockUserActionRepository: {
		logAction: SinonStub;
	};
	let mockNotificationService: {
		createNotification: SinonStub;
	};
	let mockEventBus: {
		queueTransactional: SinonStub;
	};
	let mockFeedInteractionHandler: {};
	let mockDTOService: {
		toPostDTO: SinonStub;
	};
	let mockSession: ClientSession;

	beforeEach(() => {
		// Create mock objects with Sinon stubs
		mockUnitOfWork = {
			executeInTransaction: sinon.stub(),
		};

		mockPostRepository = {
			findByPublicId: sinon.stub(),
			hasUserLiked: sinon.stub(),
			addLike: sinon.stub(),
			removeLike: sinon.stub(),
		};

		mockUserRepository = {
			findByPublicId: sinon.stub(),
		};

		mockUserActionRepository = {
			logAction: sinon.stub(),
		};

		mockNotificationService = {
			createNotification: sinon.stub(),
		};

		mockEventBus = {
			queueTransactional: sinon.stub(),
		};

		mockDTOService = {
			toPostDTO: sinon.stub(),
		};

		mockFeedInteractionHandler = {};
		mockSession = {} as ClientSession;

		// Create handler with mocked dependencies
		handler = new LikeActionByPublicIdCommandHandler(
			mockUnitOfWork as any,
			mockPostRepository as any,
			mockUserActionRepository as any,
			mockUserRepository as any,
			mockNotificationService as any,
			mockEventBus as any,
			mockFeedInteractionHandler as any,
			mockDTOService as any
		);

		command = new LikeActionByPublicIdCommand("user-123", "post-456");
	});

	afterEach(() => {
		sinon.restore();
	});

	describe("Command Creation", () => {
		it("should create command with correct properties", () => {
			expect(command.userPublicId).to.equal("user-123");
			expect(command.postPublicId).to.equal("post-456");
			expect(command.type).to.equal("LikeActionByPublicIdCommand");
		});
	});

	describe("Execute Method", () => {
		it("should throw error when user not found", async () => {
			mockUserRepository.findByPublicId.resolves(null);

			await expect(handler.execute(command)).to.be.rejectedWith(
				`User with public ID ${command.userPublicId} not found`
			);
		});

		it("should throw error when post not found", async () => {
			const mockUser = { _id: new Types.ObjectId(), publicId: "user-123", username: "testuser" };
			mockUserRepository.findByPublicId.resolves(mockUser);
			mockPostRepository.findByPublicId.resolves(null);

			await expect(handler.execute(command)).to.be.rejectedWith("Post with public ID post-456 not found");
		});

		it("should handle like action correctly when post exists and user has not liked", async () => {
			const mockUser = { _id: new Types.ObjectId(), publicId: "user-123", username: "testuser" };
			const mockPost: Partial<IPost> = {
				_id: new Types.ObjectId(),
				publicId: "post-456",
				body: "Test post",
				user: { publicId: "other-user" } as any,
				tags: [{ tag: "test" }] as any,
				likesCount: 0,
				commentsCount: 0,
			};

			const mockPostDTO = {
				publicId: "post-456",
				body: "Test post",
				user: { publicId: "other-user" },
				tags: [{ tag: "test" }],
				likesCount: 1,
				commentsCount: 0,
			};

			mockUserRepository.findByPublicId.resolves(mockUser);
			mockPostRepository.findByPublicId.resolves(mockPost);
			mockPostRepository.hasUserLiked.resolves(false);
			mockPostRepository.addLike.resolves(true);
			mockDTOService.toPostDTO.resolves(mockPostDTO);

			mockUnitOfWork.executeInTransaction.callsFake(async (callback) => {
				await callback(mockSession);
			});

			const result = await handler.execute(command);

			expect(mockUserRepository.findByPublicId.calledWith("user-123")).to.be.true;
			expect(mockPostRepository.findByPublicId.calledWith("post-456")).to.be.true;
			expect(mockPostRepository.hasUserLiked.calledWith(mockPost._id!.toString(), mockUser._id.toString(), mockSession))
				.to.be.true;
			expect(mockPostRepository.addLike.calledWith(mockPost._id!.toString(), mockUser._id.toString(), mockSession)).to
				.be.true;
			expect(mockUnitOfWork.executeInTransaction.called).to.be.true;
			expect(mockDTOService.toPostDTO.called).to.be.true;
			expect(result).to.equal(mockPostDTO);
		});

		it("should handle unlike action correctly when post exists and user has already liked", async () => {
			const mockUser = { _id: new Types.ObjectId(), publicId: "user-123", username: "testuser" };
			const mockPost: Partial<IPost> = {
				_id: new Types.ObjectId(),
				publicId: "post-456",
				body: "Test post",
				user: { publicId: "other-user" } as any,
				tags: [{ tag: "test" }] as any,
				likesCount: 1,
				commentsCount: 0,
			};

			const mockPostDTO = {
				publicId: "post-456",
				body: "Test post",
				user: { publicId: "other-user" },
				tags: [{ tag: "test" }],
				likesCount: 0,
				commentsCount: 0,
			};

			mockUserRepository.findByPublicId.resolves(mockUser);
			mockPostRepository.findByPublicId.resolves(mockPost);
			mockPostRepository.hasUserLiked.resolves(true);
			mockPostRepository.removeLike.resolves(true);
			mockDTOService.toPostDTO.resolves(mockPostDTO);

			mockUnitOfWork.executeInTransaction.callsFake(async (callback) => {
				await callback(mockSession);
			});

			const result = await handler.execute(command);

			expect(mockUserRepository.findByPublicId.calledWith("user-123")).to.be.true;
			expect(mockPostRepository.findByPublicId.calledWith("post-456")).to.be.true;
			expect(mockPostRepository.hasUserLiked.calledWith(mockPost._id!.toString(), mockUser._id.toString(), mockSession))
				.to.be.true;
			expect(mockPostRepository.removeLike.calledWith(mockPost._id!.toString(), mockUser._id.toString(), mockSession))
				.to.be.true;
			expect(mockUnitOfWork.executeInTransaction.called).to.be.true;
			expect(mockDTOService.toPostDTO.called).to.be.true;
			expect(result).to.equal(mockPostDTO);
		});
	});
});
