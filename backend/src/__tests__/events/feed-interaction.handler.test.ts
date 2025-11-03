import "reflect-metadata";
import { describe, it, beforeEach } from "mocha";
import { container } from "tsyringe";
import { expect } from "chai";
import * as sinon from "sinon";
import { FeedInteractionHandler } from "../../application/events/user/feed-interaction.handler";
import { UserInteractedWithPostEvent } from "../../application/events/user/user-interaction.event";
import { FeedService } from "../../services/feed.service";
import { RedisService } from "../../services/redis.service";
import { UserRepository } from "../../repositories/user.repository";
import { UserPreferenceRepository } from "../../repositories/userPreference.repository";
import { ImageRepository } from "../../repositories/image.repository";
import { IImage } from "../../types";

describe("FeedInteractionHandler", () => {
	let handler: FeedInteractionHandler;
	let feedServiceMock: sinon.SinonStubbedInstance<FeedService>;
	let redisServiceMock: sinon.SinonStubbedInstance<RedisService>;
	let userRepositoryMock: sinon.SinonStubbedInstance<UserRepository>;
	let userPreferenceRepositoryMock: sinon.SinonStubbedInstance<UserPreferenceRepository>;
	let imageRepositoryMock: sinon.SinonStubbedInstance<ImageRepository>;

	beforeEach(() => {
		// Create stubs for all dependencies
		feedServiceMock = sinon.createStubInstance(FeedService);
		redisServiceMock = sinon.createStubInstance(RedisService);
		userRepositoryMock = sinon.createStubInstance(UserRepository);
		userPreferenceRepositoryMock = sinon.createStubInstance(UserPreferenceRepository);
		imageRepositoryMock = sinon.createStubInstance(ImageRepository);

		// Register mocks in the DI container
		container.register("FeedService", { useValue: feedServiceMock });
		container.register("RedisService", { useValue: redisServiceMock });
		container.register("UserRepository", { useValue: userRepositoryMock });
		container.register("UserPreferenceRepository", { useValue: userPreferenceRepositoryMock });
		container.register("ImageRepository", { useValue: imageRepositoryMock });

		// Resolve the handler with mocked dependencies
		handler = container.resolve(FeedInteractionHandler);
	});

	afterEach(() => {
		sinon.restore();
		container.clearInstances();
	});

	it("should handle a 'like' event by updating meta and invalidating only the actor's feed", async () => {
		// Arrange
		const event = new UserInteractedWithPostEvent("user123", "like", "imageABC", ["tag1"], "owner456");
		const mockImage = { publicId: "imageABC", likes: 10 } as IImage;

		imageRepositoryMock.findByPublicId.resolves(mockImage);
		feedServiceMock.recordInteraction.resolves();
		feedServiceMock.updatePostLikeMeta.resolves();
		redisServiceMock.deletePatterns.resolves();

		// Act
		await handler.handle(event);

		// Assert
		// 1. It should record the base interaction
		expect(feedServiceMock.recordInteraction.calledOnceWith("user123", "like", "imageABC", ["tag1"])).to.be.true;

		// 2. It should update the post's like metadata cache
		expect(imageRepositoryMock.findByPublicId.calledOnceWith("imageABC")).to.be.true;
		expect(feedServiceMock.updatePostLikeMeta.calledOnceWith("imageABC", 10)).to.be.true;

		// 3. It should invalidate only the actor's structural feed cache
		expect(redisServiceMock.deletePatterns.calledOnceWith([`core_feed:user123:*`, `feed:user123:*`])).to.be.true;

		// 4. It should NOT perform broader invalidation for a simple like
		expect(userRepositoryMock.findUsersFollowing.called).to.be.false;
		expect(redisServiceMock.del.called).to.be.false;
	});

	it("should handle a 'comment' event by performing broader feed invalidation", async () => {
		// Arrange
		const event = new UserInteractedWithPostEvent("user123", "comment", "imageABC", ["tag1"], "owner456");

		// Mock affected user lookups
		userRepositoryMock.findUsersFollowing
			.withArgs("owner456")
			.resolves([{ publicId: "follower1" }, { publicId: "follower2" }] as any);
		userPreferenceRepositoryMock.getUsersWithTagPreferences
			.withArgs(["tag1"])
			.resolves([{ publicId: "tagLover1" }] as any);

		feedServiceMock.recordInteraction.resolves();
		redisServiceMock.deletePatterns.resolves();
		redisServiceMock.del.resolves();

		// Act
		await handler.handle(event);

		// Assert
		// 1. It should record the base interaction
		expect(feedServiceMock.recordInteraction.calledOnceWith("user123", "comment", "imageABC", ["tag1"])).to.be.true;

		// 2. It should NOT update like meta for a comment
		expect(feedServiceMock.updatePostLikeMeta.called).to.be.false;

		// 3. It should invalidate the actor's feed first
		expect(redisServiceMock.deletePatterns.calledOnceWith([`feed:user123:*`, `core_feed:user123:*`])).to.be.true;

		// 4. It should find all other affected users (followers and tag-interested users)
		expect(userRepositoryMock.findUsersFollowing.calledOnce).to.be.true;
		expect(userPreferenceRepositoryMock.getUsersWithTagPreferences.calledOnce).to.be.true;

		// 5. It should invalidate the feeds of all affected users
		const expectedDeletions = [
			"feed:follower1:*",
			"feed:follower2:*",
			"feed:tagLover1:*",
			"core_feed:follower1:*",
			"core_feed:follower2:*",
			"core_feed:tagLover1:*",
		];
		expect(redisServiceMock.del.callCount).to.equal(expectedDeletions.length);
		for (const pattern of expectedDeletions) {
			expect(redisServiceMock.del.calledWith(pattern)).to.be.true;
		}
	});

	it("should throw an error if recordInteraction fails", async () => {
		// Arrange
		const event = new UserInteractedWithPostEvent("user123", "like", "imageABC", [], "owner456");
		const testError = new Error("Database connection lost");
		feedServiceMock.recordInteraction.rejects(testError);

		// Act & Assert
		try {
			await handler.handle(event);
			// If it doesn't throw, the test should fail
			expect.fail("Handler did not throw an error as expected.");
		} catch (error: any) {
			expect(error).to.equal(testError);
			expect(error.message).to.equal("Database connection lost");
		}

		// Ensure it doesn't proceed to invalidation steps on failure
		expect(redisServiceMock.deletePatterns.called).to.be.false;
	});
});
