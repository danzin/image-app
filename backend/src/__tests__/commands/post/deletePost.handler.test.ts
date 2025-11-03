import { describe, beforeEach, afterEach, it } from "mocha";
import * as chai from "chai";
import { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import sinon, { SinonStub } from "sinon";
import { ClientSession, Types } from "mongoose";
import { DeletePostCommand } from "../../../application/commands/post/deletePost/deletePost.command";
import { DeletePostCommandHandler } from "../../../application/commands/post/deletePost/deletePost.handler";

chai.use(chaiAsPromised);

describe("DeletePostCommandHandler", () => {
	let handler: DeletePostCommandHandler;
	let command: DeletePostCommand;
	let mockUnitOfWork: {
		executeInTransaction: SinonStub;
	};
	let mockPostRepository: {
		findByPublicId: SinonStub;
		delete: SinonStub;
	};
	let mockUserRepository: {
		findByPublicId: SinonStub;
		findById: SinonStub;
	};
	let mockCommentRepository: {
		deleteCommentsByPostId: SinonStub;
	};
	let mockTagService: {
		decrementUsage: SinonStub;
	};
	let mockImageService: {
		deleteImage: SinonStub;
		removePostAttachment: SinonStub;
	};
	let mockRedisService: {
		invalidateFeed: SinonStub;
		invalidateByTags: SinonStub;
	};
	let mockEventBus: {
		queueTransactional: SinonStub;
		publish: SinonStub;
	};
	let mockSession: ClientSession;

	beforeEach(() => {
		mockUnitOfWork = {
			executeInTransaction: sinon.stub(),
		};

		mockPostRepository = {
			findByPublicId: sinon.stub(),
			delete: sinon.stub(),
		};

		mockUserRepository = {
			findByPublicId: sinon.stub(),
			findById: sinon.stub(),
		};

		mockCommentRepository = {
			deleteCommentsByPostId: sinon.stub(),
		};

		mockTagService = {
			decrementUsage: sinon.stub(),
		};

		mockImageService = {
			deleteImage: sinon.stub(),
			removePostAttachment: sinon.stub().resolves({ removed: false }),
		};

		mockRedisService = {
			invalidateFeed: sinon.stub(),
			invalidateByTags: sinon.stub().resolves(),
		};

		mockEventBus = {
			queueTransactional: sinon.stub(),
			publish: sinon.stub().resolves(),
		};

		mockSession = {} as ClientSession;

		handler = new DeletePostCommandHandler(
			mockUnitOfWork as any,
			mockPostRepository as any,
			mockUserRepository as any,
			mockCommentRepository as any,
			mockTagService as any,
			mockImageService as any,
			mockRedisService as any,
			mockEventBus as any
		);

		command = new DeletePostCommand("post-123", "user-123");
	});

	afterEach(() => {
		sinon.restore();
	});

	describe("Command Creation", () => {
		it("should create command with correct properties", () => {
			expect(command.postPublicId).to.equal("post-123");
			expect(command.requesterPublicId).to.equal("user-123");
			expect(command.type).to.equal("DeletePostCommand");
		});
	});

	describe("Execute Method", () => {
		it("should throw error when post not found", async () => {
			mockPostRepository.findByPublicId.resolves(null);

			mockUnitOfWork.executeInTransaction.callsFake(async (callback) => {
				return await callback(mockSession);
			});

			await expect(handler.execute(command)).to.be.rejectedWith("Post not found");
		});

		it("should throw error when user not found", async () => {
			const mockUserId = new Types.ObjectId();

			const mockPost = {
				_id: new Types.ObjectId(),
				publicId: "post-123",
				body: "Test post",
				image: new Types.ObjectId(),
				tags: [],
				user: mockUserId,
			};

			mockPostRepository.findByPublicId.resolves(mockPost);
			mockUserRepository.findByPublicId.resolves(null);

			mockUnitOfWork.executeInTransaction.callsFake(async (callback) => {
				return await callback(mockSession);
			});

			await expect(handler.execute(command)).to.be.rejectedWith("User not found");
		});

		it("should delete post successfully with tags and image", async () => {
			const mockUserId = new Types.ObjectId();
			const mockImageId = new Types.ObjectId();
			const mockTagIds = [new Types.ObjectId(), new Types.ObjectId()];

			const mockUser = {
				_id: mockUserId,
				publicId: "user-123",
			};

			const mockPost = {
				_id: new Types.ObjectId(),
				publicId: "post-123",
				body: "Test post",
				image: mockImageId,
				tags: mockTagIds,
				user: mockUserId,
			};

			mockUserRepository.findByPublicId.resolves(mockUser);
			mockUserRepository.findById.resolves(mockUser);
			mockPostRepository.findByPublicId.resolves(mockPost);
			mockCommentRepository.deleteCommentsByPostId.resolves();
			mockTagService.decrementUsage.resolves();
			mockPostRepository.delete.resolves();
			mockImageService.removePostAttachment.resolves({ removed: true });

			mockUnitOfWork.executeInTransaction.callsFake(async (callback) => {
				return await callback(mockSession);
			});

			const result = await handler.execute(command);

			expect(mockPostRepository.findByPublicId.calledWith("post-123")).to.be.true;
			expect(mockUserRepository.findByPublicId.calledWith("user-123")).to.be.true;
			expect(mockImageService.removePostAttachment.called).to.be.true;
			expect(mockTagService.decrementUsage.calledWith(mockTagIds, mockSession)).to.be.true;
			expect(mockPostRepository.delete.called).to.be.true;
			expect(mockCommentRepository.deleteCommentsByPostId.called).to.be.true;
			expect(mockUnitOfWork.executeInTransaction.called).to.be.true;
			expect(result).to.have.property("message");
		});

		it("should handle post without image", async () => {
			const mockUserId = new Types.ObjectId();
			const mockTagIds = [new Types.ObjectId()];

			const mockUser = {
				_id: mockUserId,
				publicId: "user-123",
			};

			const mockPost = {
				_id: new Types.ObjectId(),
				publicId: "post-123",
				body: "Test post",
				image: null,
				tags: mockTagIds,
				user: mockUserId,
			};

			mockUserRepository.findByPublicId.resolves(mockUser);
			mockUserRepository.findById.resolves(mockUser);
			mockPostRepository.findByPublicId.resolves(mockPost);
			mockCommentRepository.deleteCommentsByPostId.resolves();
			mockPostRepository.delete.resolves();
			mockTagService.decrementUsage.resolves();

			mockUnitOfWork.executeInTransaction.callsFake(async (callback) => {
				return await callback(mockSession);
			});

			await handler.execute(command);

			expect(mockImageService.removePostAttachment.called).to.be.false;
			expect(mockTagService.decrementUsage.calledWith(mockTagIds, mockSession)).to.be.true;
			expect(mockPostRepository.delete.called).to.be.true;
		});

		it("should handle post without tags", async () => {
			const mockUserId = new Types.ObjectId();

			const mockUser = {
				_id: mockUserId,
				publicId: "user-123",
			};

			const mockPost = {
				_id: new Types.ObjectId(),
				publicId: "post-123",
				body: "Test post",
				image: new Types.ObjectId(),
				tags: [],
				user: mockUserId,
			};

			mockUserRepository.findByPublicId.resolves(mockUser);
			mockUserRepository.findById.resolves(mockUser);
			mockPostRepository.findByPublicId.resolves(mockPost);
			mockCommentRepository.deleteCommentsByPostId.resolves();
			mockPostRepository.delete.resolves();
			mockImageService.removePostAttachment.resolves({ removed: true });

			mockUnitOfWork.executeInTransaction.callsFake(async (callback) => {
				return await callback(mockSession);
			});

			await handler.execute(command);

			expect(mockTagService.decrementUsage.called).to.be.false;
			expect(mockPostRepository.delete.called).to.be.true;
		});

		it("should continue post deletion even if image deletion fails", async () => {
			const mockUserId = new Types.ObjectId();
			const mockTagIds = [new Types.ObjectId()];

			const mockUser = {
				_id: mockUserId,
				publicId: "user-123",
			};

			const mockPost = {
				_id: new Types.ObjectId(),
				publicId: "post-123",
				body: "Test post",
				image: new Types.ObjectId(),
				tags: mockTagIds,
				user: mockUserId,
			};

			mockUserRepository.findByPublicId.resolves(mockUser);
			mockUserRepository.findById.resolves(mockUser);
			mockPostRepository.findByPublicId.resolves(mockPost);
			mockCommentRepository.deleteCommentsByPostId.resolves();
			mockPostRepository.delete.resolves();
			mockTagService.decrementUsage.resolves();
			mockImageService.removePostAttachment.rejects(new Error("Image service unavailable"));

			mockUnitOfWork.executeInTransaction.callsFake(async (callback) => {
				return await callback(mockSession);
			});

			const result = await handler.execute(command);

			expect(mockPostRepository.delete.called).to.be.true;
			expect(mockTagService.decrementUsage.called).to.be.true;
			expect(result).to.have.property("message", "Post deleted successfully");
		});

		it("should queue PostDeletedEvent after successful deletion", async () => {
			const mockUserId = new Types.ObjectId();

			const mockUser = {
				_id: mockUserId,
				publicId: "user-123",
			};

			const mockPost = {
				_id: new Types.ObjectId(),
				publicId: "post-123",
				body: "Test post",
				image: new Types.ObjectId(),
				tags: [new Types.ObjectId()],
				user: mockUserId,
			};

			mockUserRepository.findByPublicId.resolves(mockUser);
			mockUserRepository.findById.resolves(mockUser);
			mockPostRepository.findByPublicId.resolves(mockPost);
			mockCommentRepository.deleteCommentsByPostId.resolves();
			mockTagService.decrementUsage.resolves();
			mockPostRepository.delete.resolves();
			mockImageService.removePostAttachment.resolves({ removed: true });

			mockUnitOfWork.executeInTransaction.callsFake(async (callback) => {
				return await callback(mockSession);
			});

			await handler.execute(command);

			expect(mockEventBus.publish.calledOnce).to.be.true;
		});

		it("should invalidate user feed cache after deletion", async () => {
			const mockUserId = new Types.ObjectId();

			const mockUser = {
				_id: mockUserId,
				publicId: "user-123",
			};

			const mockPost = {
				_id: new Types.ObjectId(),
				publicId: "post-123",
				body: "Test post",
				image: null,
				tags: [],
				user: mockUserId,
			};

			mockUserRepository.findByPublicId.resolves(mockUser);
			mockUserRepository.findById.resolves(mockUser);
			mockPostRepository.findByPublicId.resolves(mockPost);
			mockCommentRepository.deleteCommentsByPostId.resolves();
			mockPostRepository.delete.resolves();

			mockUnitOfWork.executeInTransaction.callsFake(async (callback) => {
				return await callback(mockSession);
			});

			await handler.execute(command);

			expect(mockRedisService.invalidateByTags.calledWith([`user_feed:user-123`])).to.be.true;
		});
	});
});
