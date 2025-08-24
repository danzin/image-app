import { describe, beforeEach, afterEach, it } from "mocha";
import * as chai from "chai";
import { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import sinon, { SinonStub } from "sinon";
import { ClientSession, Types } from "mongoose";
import { LikeActionByPublicIdCommand } from "../../../../application/commands/users/likeActionByPublicId/likeActionByPublicId.command";
import { LikeActionByPublicIdCommandHandler } from "../../../../application/commands/users/likeActionByPublicId/likeActionByPublicId.handler";
import { IImage } from "../../../../types";

chai.use(chaiAsPromised);

describe("LikeActionByPublicIdCommandHandler", () => {
	let handler: LikeActionByPublicIdCommandHandler;
	let command: LikeActionByPublicIdCommand;
	let mockUnitOfWork: {
		executeInTransaction: SinonStub;
	};
	let mockImageRepository: {
		findByPublicId: SinonStub;
		findOneAndUpdate: SinonStub;
	};
	let mockLikeRepository: {
		findByUserAndImage: SinonStub;
		create: SinonStub;
		deleteLike: SinonStub;
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
	let mockSession: ClientSession;

	beforeEach(() => {
		// Create mock objects with Sinon stubs
		mockUnitOfWork = {
			executeInTransaction: sinon.stub(),
		};

		mockImageRepository = {
			findByPublicId: sinon.stub(),
			findOneAndUpdate: sinon.stub(),
		};

		mockLikeRepository = {
			findByUserAndImage: sinon.stub(),
			create: sinon.stub(),
			deleteLike: sinon.stub(),
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

		mockFeedInteractionHandler = {};
		mockSession = {} as ClientSession;

		// Create handler with mocked dependencies
		handler = new LikeActionByPublicIdCommandHandler(
			mockUnitOfWork as any,
			mockImageRepository as any,
			mockLikeRepository as any,
			mockUserActionRepository as any,
			mockUserRepository as any,
			mockNotificationService as any,
			mockEventBus as any,
			mockFeedInteractionHandler as any
		);

		command = new LikeActionByPublicIdCommand(new Types.ObjectId().toString(), "img-public-123");
	});

	afterEach(() => {
		sinon.restore();
	});

	describe("Command Creation", () => {
		it("should create command with correct properties", () => {
			expect(command.userPublicId).to.have.lengthOf(24); // Valid ObjectId length
			expect(command.imagePublicId).to.equal("img-public-123");
			expect(command.type).to.equal("LikeActionByPublicIdCommand");
		});
	});

	describe("Execute Method", () => {
		it("should throw error when user not found", async () => {
			mockUserRepository.findByPublicId.resolves(null);

			await expect(handler.execute(command)).to.be.rejectedWith(`User with public ID ${command.userPublicId} not found`);
		});

		it("should throw error when image not found", async () => {
			const mockUser = { id: new Types.ObjectId().toString() };
			mockUserRepository.findByPublicId.resolves(mockUser);
			mockImageRepository.findByPublicId.resolves(null);

			await expect(handler.execute(command)).to.be.rejectedWith("Image with public ID img-public-123 not found");
		});

		it("should handle like action correctly when image exists and user has not liked", async () => {
			const mockUser = { id: new Types.ObjectId().toString() };
			const mockImage: Partial<IImage> = {
				id: new Types.ObjectId().toString(),
				tags: [{ tag: "nature" }, { tag: "landscape" }],
				user: { publicId: new Types.ObjectId() } as any,
				toJSON: () => mockImage, // Add toJSON method to mock
			};

			mockUserRepository.findByPublicId.resolves(mockUser);
			mockImageRepository.findByPublicId
				.onFirstCall()
				.resolves(mockImage) // First call in execute
				.onSecondCall()
				.resolves(mockImage); // Second call for return value

			mockLikeRepository.findByUserAndImage.resolves(null); // No existing like

			mockUnitOfWork.executeInTransaction.callsFake(async (callback) => {
				await callback(mockSession); // Mock session
			});

			const result = await handler.execute(command);

			expect(mockUserRepository.findByPublicId.calledWith(command.userPublicId)).to.be.true;
			expect(mockImageRepository.findByPublicId.calledWith("img-public-123")).to.be.true;
			expect(mockLikeRepository.findByUserAndImage.calledWith(mockUser.id, mockImage.id, mockSession)).to.be.true;
			expect(mockUnitOfWork.executeInTransaction.called).to.be.true;
			expect(result).to.equal(mockImage);
		});

		it("should handle unlike action correctly when image exists and user has already liked", async () => {
			const mockUser = { id: new Types.ObjectId().toString() };
			const mockImage: Partial<IImage> = {
				id: new Types.ObjectId().toString(),
				tags: [{ tag: "nature" }, { tag: "landscape" }],
				user: { publicId: new Types.ObjectId() } as any,
				toJSON: () => mockImage, // Add toJSON method to mock
			};

			const mockExistingLike = {
				userId: mockUser.id,
				imageId: mockImage.id,
			};

			mockUserRepository.findByPublicId.resolves(mockUser);
			mockImageRepository.findByPublicId
				.onFirstCall()
				.resolves(mockImage) // First call in execute
				.onSecondCall()
				.resolves(mockImage); // Second call for return value

			mockLikeRepository.findByUserAndImage.resolves(mockExistingLike); // Existing like found

			mockUnitOfWork.executeInTransaction.callsFake(async (callback) => {
				await callback(mockSession); // Mock session
			});

			const result = await handler.execute(command);

			expect(mockUserRepository.findByPublicId.calledWith(command.userPublicId)).to.be.true;
			expect(mockImageRepository.findByPublicId.calledWith("img-public-123")).to.be.true;
			expect(mockLikeRepository.deleteLike.calledWith(mockUser.id, mockImage.id, mockSession)).to.be.true;
			expect(mockUnitOfWork.executeInTransaction.called).to.be.true;
			expect(result).to.equal(mockImage);
		});
	});
});
