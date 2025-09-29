import { describe, beforeEach, afterEach, it } from "mocha";
import * as chai from "chai";
import { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import sinon, { SinonStub, SinonStubbedInstance } from "sinon";
import { ClientSession, Types } from "mongoose";
import { FavoriteService } from "../../services/favorite.service";
import { FavoriteRepository } from "../../repositories/favorite.repository";
import { UnitOfWork } from "../../database/UnitOfWork";
import { IFavorite } from "../../types";
import { createError } from "../../utils/errors";

chai.use(chaiAsPromised);

describe("FavoriteService", () => {
	let service: FavoriteService;
	let mockFavoriteRepository: SinonStubbedInstance<FavoriteRepository>;
	let mockUnitOfWork: SinonStubbedInstance<UnitOfWork>;
	let mockSession: ClientSession;

	beforeEach(() => {
		mockFavoriteRepository = sinon.createStubInstance(FavoriteRepository);
		mockUnitOfWork = sinon.createStubInstance(UnitOfWork);
		mockSession = {} as ClientSession;

		service = new FavoriteService(mockFavoriteRepository as any, mockUnitOfWork as any);

		// Default setup for executeInTransaction - it calls the callback with session
		mockUnitOfWork.executeInTransaction.callsFake(async (callback) => {
			return callback(mockSession);
		});
	});

	afterEach(() => {
		sinon.restore();
	});

	describe("addFavorite", () => {
		const userId = new Types.ObjectId().toString();
		const imageId = new Types.ObjectId().toString();

		it("should successfully add favorite when not exists", async () => {
			mockFavoriteRepository.findByUserAndImage.resolves(null);
			mockFavoriteRepository.create.resolves({} as any);

			await service.addFavorite(userId, imageId);

			expect(mockFavoriteRepository.findByUserAndImage.calledWith(userId, imageId, mockSession)).to.be.true;
			expect(mockFavoriteRepository.create.calledWith({ userId, imageId }, mockSession)).to.be.true;
			expect(mockUnitOfWork.executeInTransaction.calledOnce).to.be.true;
		});

		it("should throw DuplicateError when favorite already exists", async () => {
			const existingFavorite = {
				_id: new Types.ObjectId(),
				userId: new Types.ObjectId(userId),
				imageId: new Types.ObjectId(imageId),
				createdAt: new Date(),
				updatedAt: new Date(),
			} as IFavorite;

			mockFavoriteRepository.findByUserAndImage.resolves(existingFavorite);

			await expect(service.addFavorite(userId, imageId)).to.be.rejectedWith("Image already in favorites");

			expect(mockFavoriteRepository.findByUserAndImage.calledWith(userId, imageId, mockSession)).to.be.true;
			expect(mockFavoriteRepository.create.notCalled).to.be.true;
		});

		it("should handle transaction failure", async () => {
			const error = new Error("Database error");
			mockUnitOfWork.executeInTransaction.rejects(error);

			await expect(service.addFavorite(userId, imageId)).to.be.rejectedWith("Database error");

			expect(mockUnitOfWork.executeInTransaction.calledOnce).to.be.true;
		});
	});

	describe("removeFavorite", () => {
		const userId = new Types.ObjectId().toString();
		const imageId = new Types.ObjectId().toString();

		it("should successfully remove favorite when exists", async () => {
			mockFavoriteRepository.remove.resolves(true);

			await service.removeFavorite(userId, imageId);

			expect(mockFavoriteRepository.remove.calledWith(userId, imageId, mockSession)).to.be.true;
			expect(mockUnitOfWork.executeInTransaction.calledOnce).to.be.true;
		});

		it("should throw NotFoundError when favorite does not exist", async () => {
			mockFavoriteRepository.remove.resolves(false);

			await expect(service.removeFavorite(userId, imageId)).to.be.rejectedWith("Favorite not found");

			expect(mockFavoriteRepository.remove.calledWith(userId, imageId, mockSession)).to.be.true;
		});

		it("should handle transaction failure", async () => {
			const error = new Error("Database error");
			mockUnitOfWork.executeInTransaction.rejects(error);

			await expect(service.removeFavorite(userId, imageId)).to.be.rejectedWith("Database error");

			expect(mockUnitOfWork.executeInTransaction.calledOnce).to.be.true;
		});
	});

	describe("transaction handling", () => {
		const userId = new Types.ObjectId().toString();
		const imageId = new Types.ObjectId().toString();

		it("should use UnitOfWork for addFavorite operations", async () => {
			mockFavoriteRepository.findByUserAndImage.resolves(null);
			mockFavoriteRepository.create.resolves({} as any);

			await service.addFavorite(userId, imageId);

			expect(mockUnitOfWork.executeInTransaction.calledOnce).to.be.true;
			// Verify the callback was called with proper session handling
			const callback = mockUnitOfWork.executeInTransaction.getCall(0).args[0];
			expect(typeof callback).to.equal("function");
		});

		it("should use UnitOfWork for removeFavorite operations", async () => {
			mockFavoriteRepository.remove.resolves(true);

			await service.removeFavorite(userId, imageId);

			expect(mockUnitOfWork.executeInTransaction.calledOnce).to.be.true;
			// Verify the callback was called with proper session handling
			const callback = mockUnitOfWork.executeInTransaction.getCall(0).args[0];
			expect(typeof callback).to.equal("function");
		});
	});
});
