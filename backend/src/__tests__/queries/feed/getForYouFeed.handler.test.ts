import { describe, beforeEach, afterEach, it } from "mocha";
import * as chai from "chai";
import { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import sinon, { SinonStub } from "sinon";

import { GetForYouFeedQueryHandler } from "@/application/queries/feed/getForYouFeed/getForYouFeed.handler";
import { GetForYouFeedQuery } from "@/application/queries/feed/getForYouFeed/getForYouFeed.query";

chai.use(chaiAsPromised);

describe("GetForYouFeedQueryHandler", () => {
	let handler: GetForYouFeedQueryHandler;

	let mockPostReadRepository: { findPostsByPublicIds: SinonStub; getRankedFeed: SinonStub };
	let mockUserReadRepository: { findByPublicId: SinonStub };
	let mockUserPreferenceRepository: { getTopUserTags: SinonStub };
	let mockRedisService: { getFeedPage: SinonStub; getFeedSize: SinonStub; addToFeed: SinonStub };
	let mockEventBus: { publish: SinonStub };
	let mockFeedEnrichmentService: { enrichFeedWithCurrentData: SinonStub };

	beforeEach(() => {
		mockPostReadRepository = {
			findPostsByPublicIds: sinon.stub(),
			getRankedFeed: sinon.stub(),
		};
		mockUserReadRepository = { findByPublicId: sinon.stub() };
		mockUserPreferenceRepository = { getTopUserTags: sinon.stub() };
		mockRedisService = {
			getFeedPage: sinon.stub(),
			getFeedSize: sinon.stub(),
			addToFeed: sinon.stub().resolves(),
		};
		mockEventBus = { publish: sinon.stub() };
		mockFeedEnrichmentService = { enrichFeedWithCurrentData: sinon.stub() };

		handler = new GetForYouFeedQueryHandler(
			mockPostReadRepository as any,
			mockUserReadRepository as any,
			mockUserPreferenceRepository as any,
			mockRedisService as any,
			mockEventBus as any,
			mockFeedEnrichmentService as any,
		);
	});

	afterEach(() => {
		sinon.restore();
	});

	it("returns from Redis feed when ZSET hit", async () => {
		mockRedisService.getFeedPage.resolves(["p1"]);
		mockPostReadRepository.findPostsByPublicIds.resolves([
			{ publicId: "p1", body: "b1", slug: "s1", createdAt: new Date(), likesCount: 1, commentsCount: 0, viewsCount: 0, author: { publicId: "u1", handle: "h", username: "n", avatar: "" }, tags: [] },
		]);
		mockRedisService.getFeedSize.resolves(5);
		mockFeedEnrichmentService.enrichFeedWithCurrentData.callsFake(async (posts: any) => posts);

		const result = await handler.execute(new GetForYouFeedQuery("viewer", 1, 10));

		expect(mockPostReadRepository.getRankedFeed.called).to.be.false;
		expect(result.total).to.equal(5);
		expect(result.data[0].publicId).to.equal("p1");
	});

	it("generates from DB and populates ZSET on page 1 miss", async () => {
		mockRedisService.getFeedPage.resolves([]);
		mockUserReadRepository.findByPublicId.resolves({ _id: "userObjectId" });
		mockUserPreferenceRepository.getTopUserTags.resolves([{ tag: "cats" }]);
		mockPostReadRepository.getRankedFeed.resolves({ data: [{ publicId: "p1", body: "b1", slug: "s1", createdAt: new Date(), likesCount: 1, commentsCount: 0, viewsCount: 0, author: { publicId: "u1", handle: "h", username: "n", avatar: "" }, tags: [] }], total: 1, page: 1, limit: 10, totalPages: 1 });
		mockFeedEnrichmentService.enrichFeedWithCurrentData.callsFake(async (posts: any) => posts);

		const result = await handler.execute(new GetForYouFeedQuery("viewer", 1, 10));

		expect(mockPostReadRepository.getRankedFeed.calledOnce).to.be.true;
		expect(mockRedisService.addToFeed.called).to.be.true;
		expect(result.total).to.equal(1);
	});

	it("does not populate ZSET on page > 1 miss", async () => {
		mockRedisService.getFeedPage.resolves([]);
		mockUserReadRepository.findByPublicId.resolves({ _id: "userObjectId" });
		mockUserPreferenceRepository.getTopUserTags.resolves([]);
		mockPostReadRepository.getRankedFeed.resolves({ data: [], total: 0, page: 2, limit: 10, totalPages: 0 });
		mockFeedEnrichmentService.enrichFeedWithCurrentData.callsFake(async (posts: any) => posts);

		await handler.execute(new GetForYouFeedQuery("viewer", 2, 10));
		expect(mockRedisService.addToFeed.called).to.be.false;
	});

	it("wraps errors as FeedError", async () => {
		mockRedisService.getFeedPage.resolves([]);
		mockUserReadRepository.findByPublicId.resolves(null);

		await expect(handler.execute(new GetForYouFeedQuery("viewer", 1, 10))).to.be.rejectedWith("Could not generate For You feed.");
	});
});
