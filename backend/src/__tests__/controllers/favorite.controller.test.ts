import { describe, beforeEach, afterEach, it } from "mocha";
import * as chai from "chai";
import { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import sinon, { SinonStub, SinonStubbedInstance } from "sinon";
import { Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import { FavoriteController } from "../../controllers/favorite.controller";
import { FavoriteService } from "../../services/favorite.service";
import { FavoriteRepository } from "../../repositories/favorite.repository";
import { UserRepository } from "../../repositories/user.repository";
import { ImageRepository } from "../../repositories/image.repository";
import { DTOService } from "../../services/dto.service";
import { IImage } from "../../types";

// Extend Request interface to include decodedUser
interface TestRequest extends Request {
	decodedUser?: {
		publicId: string;
	};
}

chai.use(chaiAsPromised);

describe("FavoriteController", () => {
	let controller: FavoriteController;
	let mockFavoriteService: SinonStubbedInstance<FavoriteService>;
	let mockFavoriteRepository: SinonStubbedInstance<FavoriteRepository>;
	let mockUserRepository: SinonStubbedInstance<UserRepository>;
	let mockImageRepository: SinonStubbedInstance<ImageRepository>;
	let mockDTOService: SinonStubbedInstance<DTOService>;
	let mockReq: Partial<TestRequest>;
	let mockRes: Partial<Response>;
	let mockNext: SinonStub;

	const createMockResponse = (): Partial<Response> => {
		const res: Partial<Response> = {};
		res.status = sinon.stub().returns(res);
		res.send = sinon.stub().returns(res);
		res.json = sinon.stub().returns(res);
		return res;
	};

	beforeEach(() => {
		mockFavoriteService = sinon.createStubInstance(FavoriteService);
		mockFavoriteRepository = sinon.createStubInstance(FavoriteRepository);
		mockUserRepository = sinon.createStubInstance(UserRepository);
		mockImageRepository = sinon.createStubInstance(ImageRepository);
		mockDTOService = sinon.createStubInstance(DTOService);

		controller = new FavoriteController(
			mockFavoriteService as any,
			mockFavoriteRepository as any,
			mockUserRepository as any,
			mockImageRepository as any,
			mockDTOService as any
		);

		mockRes = createMockResponse();
		mockNext = sinon.stub();
	});

	afterEach(() => {
		sinon.restore();
	});

	describe("addFavorite", () => {
		const imagePublicId = "img-public-123";
		const userPublicId = "user-public-456";
		const internalUserId = new Types.ObjectId().toString();
		const internalImageId = new Types.ObjectId().toString();

		beforeEach(() => {
			mockReq = {
				params: { publicId: imagePublicId },
				decodedUser: { publicId: userPublicId },
			};
		});

		it("should successfully add favorite", async () => {
			mockUserRepository.findInternalIdByPublicId.resolves(internalUserId);
			mockImageRepository.findInternalIdByPublicId.resolves(internalImageId);
			mockFavoriteService.addFavorite.resolves();

			await controller.addFavorite(mockReq as TestRequest, mockRes as Response, mockNext);

			expect(mockUserRepository.findInternalIdByPublicId.calledWith(userPublicId)).to.be.true;
			expect(mockImageRepository.findInternalIdByPublicId.calledWith(imagePublicId)).to.be.true;
			expect(mockFavoriteService.addFavorite.calledWith(internalUserId, internalImageId)).to.be.true;
			expect((mockRes.status as SinonStub).calledWith(204)).to.be.true;
			expect((mockRes.send as SinonStub).calledOnce).to.be.true;
			expect(mockNext.notCalled).to.be.true;
		});

		it("should handle missing user authentication", async () => {
			mockReq.decodedUser = undefined;

			await controller.addFavorite(mockReq as TestRequest, mockRes as Response, mockNext);

			expect(mockNext.calledOnce).to.be.true;
			const error = mockNext.getCall(0).args[0];
			expect(error.name).to.equal("AuthenticationError");
			expect(error.message).to.equal("User must be logged in to favorite an image.");
		});

		it("should handle user not found", async () => {
			mockUserRepository.findInternalIdByPublicId.resolves(null);
			mockImageRepository.findInternalIdByPublicId.resolves(internalImageId);

			await controller.addFavorite(mockReq as TestRequest, mockRes as Response, mockNext);

			expect(mockNext.calledOnce).to.be.true;
			const error = mockNext.getCall(0).args[0];
			expect(error.name).to.equal("NotFoundError");
			expect(error.message).to.equal("User or Image not found");
		});

		it("should handle service errors", async () => {
			const serviceError = new Error("Service error");
			mockUserRepository.findInternalIdByPublicId.resolves(internalUserId);
			mockImageRepository.findInternalIdByPublicId.resolves(internalImageId);
			mockFavoriteService.addFavorite.rejects(serviceError);

			await controller.addFavorite(mockReq as TestRequest, mockRes as Response, mockNext);

			expect(mockNext.calledWith(serviceError)).to.be.true;
		});
	});

	describe("removeFavorite", () => {
		const imagePublicId = "img-public-123";
		const userPublicId = "user-public-456";
		const internalUserId = new Types.ObjectId().toString();
		const internalImageId = new Types.ObjectId().toString();

		beforeEach(() => {
			mockReq = {
				params: { publicId: imagePublicId },
				decodedUser: { publicId: userPublicId },
			};
		});

		it("should successfully remove favorite", async () => {
			mockUserRepository.findInternalIdByPublicId.resolves(internalUserId);
			mockImageRepository.findInternalIdByPublicId.resolves(internalImageId);
			mockFavoriteService.removeFavorite.resolves();

			await controller.removeFavorite(mockReq as TestRequest, mockRes as Response, mockNext);

			expect(mockUserRepository.findInternalIdByPublicId.calledWith(userPublicId)).to.be.true;
			expect(mockImageRepository.findInternalIdByPublicId.calledWith(imagePublicId)).to.be.true;
			expect(mockFavoriteService.removeFavorite.calledWith(internalUserId, internalImageId)).to.be.true;
			expect((mockRes.status as SinonStub).calledWith(204)).to.be.true;
			expect((mockRes.send as SinonStub).calledOnce).to.be.true;
			expect(mockNext.notCalled).to.be.true;
		});

		it("should handle missing user authentication", async () => {
			mockReq.decodedUser = undefined;

			await controller.removeFavorite(mockReq as TestRequest, mockRes as Response, mockNext);

			expect(mockNext.calledOnce).to.be.true;
			const error = mockNext.getCall(0).args[0];
			expect(error.name).to.equal("AuthenticationError");
			expect(error.message).to.equal("User must be logged in to unfavorite an image.");
		});
	});

	describe("getFavorites", () => {
		const profileOwnerPublicId = "user-public-456";
		const viewerPublicId = "user-public-456"; // Same as profile owner
		const internalUserId = new Types.ObjectId().toString();

		beforeEach(() => {
			mockReq = {
				params: { publicId: profileOwnerPublicId },
				decodedUser: { publicId: viewerPublicId },
				query: {},
			};
		});

		it("should successfully get favorites with default pagination", async () => {
			const mockImages = [
				{
					_id: new Types.ObjectId(),
					publicId: "img-1",
					url: "http://example.com/img1.jpg",
				} as Partial<IImage>,
			];
			const mockImageDTOs = [{ publicId: "img-1", url: "http://example.com/img1.jpg" }];

			mockUserRepository.findInternalIdByPublicId.resolves(internalUserId);
			mockFavoriteRepository.findFavoritesByUserId.resolves({
				data: mockImages as IImage[],
				total: 1,
			});
			mockDTOService.toPublicImageDTO.returns(mockImageDTOs[0] as any);

			await controller.getFavorites(mockReq as TestRequest, mockRes as Response, mockNext);

			expect(mockUserRepository.findInternalIdByPublicId.calledWith(profileOwnerPublicId)).to.be.true;
			expect(mockFavoriteRepository.findFavoritesByUserId.calledWith(internalUserId, 1, 20)).to.be.true;
			expect(mockDTOService.toPublicImageDTO.calledWith(mockImages[0], viewerPublicId)).to.be.true;
			expect((mockRes.status as SinonStub).calledWith(200)).to.be.true;
			expect(
				(mockRes.json as SinonStub).calledWith({
					data: mockImageDTOs,
					page: 1,
					limit: 20,
					total: 1,
					totalPages: 1,
				})
			).to.be.true;
		});

		it("should handle unauthorized access to other user's favorites", async () => {
			mockReq.decodedUser!.publicId = "different-user-456";

			await controller.getFavorites(mockReq as TestRequest, mockRes as Response, mockNext);

			expect(mockNext.calledOnce).to.be.true;
			const error = mockNext.getCall(0).args[0];
			expect(error.name).to.equal("ForbiddenError");
			expect(error.message).to.equal("You are not authorized to view this user's favorites.");
		});

		it("should handle user not found", async () => {
			mockUserRepository.findInternalIdByPublicId.resolves(null);

			await controller.getFavorites(mockReq as TestRequest, mockRes as Response, mockNext);

			expect(mockNext.calledOnce).to.be.true;
			const error = mockNext.getCall(0).args[0];
			expect(error.name).to.equal("NotFoundError");
			expect(error.message).to.equal("User not found");
		});

		it("should handle missing authentication", async () => {
			mockReq.decodedUser = undefined;

			await controller.getFavorites(mockReq as TestRequest, mockRes as Response, mockNext);

			expect(mockNext.calledOnce).to.be.true;
			const error = mockNext.getCall(0).args[0];
			expect(error.name).to.equal("ForbiddenError");
		});
	});
});
