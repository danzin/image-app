import { describe, beforeEach, afterEach, it } from "mocha";
import * as chai from "chai";
import { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import sinon, { SinonStub } from "sinon";

import { SearchPostsByTagsQueryHandler } from "@/application/queries/post/searchPostsByTags/searchPostsByTags.handler";
import { SearchPostsByTagsQuery } from "@/application/queries/post/searchPostsByTags/searchPostsByTags.query";

chai.use(chaiAsPromised);

describe("SearchPostsByTagsQueryHandler", () => {
	let handler: SearchPostsByTagsQueryHandler;

	let mockPostReadRepository: { findWithPagination: SinonStub; findByTags: SinonStub };
	let mockTagService: { resolveTagIds: SinonStub };
	let mockDTOService: { toPostDTO: SinonStub };

	beforeEach(() => {
		mockPostReadRepository = {
			findWithPagination: sinon.stub(),
			findByTags: sinon.stub(),
		};
		mockTagService = {
			resolveTagIds: sinon.stub(),
		};
		mockDTOService = {
			toPostDTO: sinon.stub().callsFake((p: any) => ({ publicId: p.publicId })),
		};

		handler = new SearchPostsByTagsQueryHandler(mockPostReadRepository as any, mockTagService as any, mockDTOService as any);
	});

	afterEach(() => {
		sinon.restore();
	});

	it("returns all posts when tags empty", async () => {
		mockPostReadRepository.findWithPagination.resolves({ data: [{ publicId: "p1" }], total: 1, page: 1, limit: 10, totalPages: 1 });

		const result = await handler.execute(new SearchPostsByTagsQuery([], 1, 10));

		expect(mockPostReadRepository.findByTags.called).to.be.false;
		expect(result.data).to.deep.equal([{ publicId: "p1" }]);
	});

	it("resolves tag IDs then queries by tags", async () => {
		mockTagService.resolveTagIds.resolves(["t1", "t2"]);
		mockPostReadRepository.findByTags.resolves({ data: [{ publicId: "p2" }], total: 1, page: 1, limit: 10, totalPages: 1 });

		const result = await handler.execute(new SearchPostsByTagsQuery(["cats"], 1, 10));

		expect(mockTagService.resolveTagIds.calledWith(["cats"])).to.be.true;
		expect(mockPostReadRepository.findByTags.calledWith(["t1", "t2"])).to.be.true;
		expect(result.data).to.deep.equal([{ publicId: "p2" }]);
	});
});
