import { describe, beforeEach, afterEach, it } from "mocha";
import * as chai from "chai";
import { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import sinon, { SinonStub } from "sinon";

import { GetPersonalizedFeedQueryHandler } from "@/application/queries/feed/getPersonalizedFeed/getPersonalizedFeed.handler";
import { GetPersonalizedFeedQuery } from "@/application/queries/feed/getPersonalizedFeed/getPersonalizedFeed.query";

chai.use(chaiAsPromised);

describe("GetPersonalizedFeedQueryHandler", () => {
	let handler: GetPersonalizedFeedQueryHandler;

	let mockPostReadRepository: { getRankedFeed: SinonStub; getFeedForUserCore: SinonStub };
	let mockUserReadRepository: { findByPublicId: SinonStub };
	let mockUserPreferenceRepository: { getTopUserTags: SinonStub };
	let mockFollowRepository: { getFollowingObjectIds: SinonStub };
	let mockRedisService: { getWithTags: SinonStub; setWithTags: SinonStub };
	let mockEventBus: { publish: SinonStub };
	let mockFeedEnrichmentService: { enrichFeedWithCurrentData: SinonStub };

	beforeEach(() => {
		mockPostReadRepository = {
			getRankedFeed: sinon.stub(),
			getFeedForUserCore: sinon.stub(),
		};
		mockUserReadRepository = { findByPublicId: sinon.stub() };
		mockUserPreferenceRepository = { getTopUserTags: sinon.stub() };
		mockFollowRepository = { getFollowingObjectIds: sinon.stub() };
		mockRedisService = {
			getWithTags: sinon.stub(),
			setWithTags: sinon.stub().resolves(),
		};
		mockEventBus = { publish: sinon.stub().resolves() };
		mockFeedEnrichmentService = { enrichFeedWithCurrentData: sinon.stub() };

		handler = new GetPersonalizedFeedQueryHandler(
			mockPostReadRepository as any,
			mockUserReadRepository as any,
			mockUserPreferenceRepository as any,
			mockFollowRepository as any,
			mockRedisService as any,
			mockEventBus as any,
			mockFeedEnrichmentService as any,
		);
	});

	afterEach(() => {
		sinon.restore();
	});

	it("returns cached core feed when Redis hit", async () => {
		mockRedisService.getWithTags.resolves({ data: [{ publicId: "p1" }], total: 1, page: 1, limit: 10, totalPages: 1 });
		mockFeedEnrichmentService.enrichFeedWithCurrentData.callsFake(async (posts: any) => posts);

		const result = await handler.execute(new GetPersonalizedFeedQuery("viewer", 1, 10));

		expect(mockRedisService.setWithTags.called).to.be.false;
		expect(result.data[0].publicId).to.equal("p1");
	});

	it("generates cold start core feed and publishes event on page 1", async () => {
		mockRedisService.getWithTags.resolves(null);
		mockUserReadRepository.findByPublicId.resolves({ id: "internalUserId" });
		mockUserPreferenceRepository.getTopUserTags.resolves([]);
		mockFollowRepository.getFollowingObjectIds.resolves([]);

		mockPostReadRepository.getRankedFeed.resolves({ data: [{ publicId: "p1" }], total: 1, page: 1, limit: 10, totalPages: 1 });
		mockFeedEnrichmentService.enrichFeedWithCurrentData.callsFake(async (posts: any) => posts);

		const result = await handler.execute(new GetPersonalizedFeedQuery("viewer", 1, 10));

		expect(mockEventBus.publish.calledOnce).to.be.true;
		expect(mockPostReadRepository.getRankedFeed.calledOnce).to.be.true;
		expect(mockRedisService.setWithTags.calledOnce).to.be.true;
		expect(result.data[0].publicId).to.equal("p1");
	});

	it("uses core feed for following/tag preferences", async () => {
		mockRedisService.getWithTags.resolves(null);
		mockUserReadRepository.findByPublicId.resolves({ id: "internalUserId" });
		mockUserPreferenceRepository.getTopUserTags.resolves([{ tag: "cats" }]);
		mockFollowRepository.getFollowingObjectIds.resolves(["followedId"]);

		mockPostReadRepository.getFeedForUserCore.resolves({ data: [{ publicId: "p2" }], total: 1, page: 1, limit: 10, totalPages: 1 });
		mockFeedEnrichmentService.enrichFeedWithCurrentData.callsFake(async (posts: any) => posts);

		const result = await handler.execute(new GetPersonalizedFeedQuery("viewer", 1, 10));

		expect(mockPostReadRepository.getFeedForUserCore.calledOnce).to.be.true;
		expect(mockPostReadRepository.getRankedFeed.called).to.be.false;
		expect(result.data[0].publicId).to.equal("p2");
	});
});
