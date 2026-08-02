import { describe, beforeEach, afterEach, it } from "mocha";
import * as chai from "chai";
import { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import sinon, { SinonStub } from "sinon";

import { SearchPostsByTagsQueryHandler } from "@/application/queries/post/searchPostsByTags/searchPostsByTags.handler";
import { SearchPostsByTagsQuery } from "@/application/queries/post/searchPostsByTags/searchPostsByTags.query";
import type { PostSearchLookup } from "@/application/ports/post-search-lookup";

chai.use(chaiAsPromised);

describe("SearchPostsByTagsQueryHandler", () => {
	let handler: SearchPostsByTagsQueryHandler;

	let mockPostSearchLookup: {
		findWithPagination: SinonStub;
		findByTags: SinonStub;
	};
	let mockTagService: { resolveTagIds: SinonStub };
	let mockDTOService: { toPostDTO: SinonStub };

	beforeEach(() => {
		mockPostSearchLookup = {
			findWithPagination: sinon.stub(),
			findByTags: sinon.stub(),
		};
		mockTagService = {
			resolveTagIds: sinon.stub(),
		};
		mockDTOService = {
			toPostDTO: sinon.stub().callsFake((p: any) => ({ publicId: p.publicId })),
		};

		handler = new SearchPostsByTagsQueryHandler(mockPostSearchLookup as unknown as PostSearchLookup, mockTagService as any, mockDTOService as any);
	});

	afterEach(() => {
		sinon.restore();
	});

	it("returns all posts when tags empty", async () => {
		mockPostSearchLookup.findWithPagination.resolves({ data: [{ publicId: "p1" }], total: 1, page: 1, limit: 10, totalPages: 1 });

		const result = await handler.execute(new SearchPostsByTagsQuery([], 1, 10));

		expect(mockPostSearchLookup.findByTags.called).to.be.false;
		expect(result.data).to.deep.equal([{ publicId: "p1" }]);
	});

	it("resolves tag IDs then queries by tags", async () => {
		mockTagService.resolveTagIds.resolves(["t1", "t2"]);
		mockPostSearchLookup.findByTags.resolves({ data: [{ publicId: "p2" }], total: 1, page: 1, limit: 10, totalPages: 1 });

		const result = await handler.execute(new SearchPostsByTagsQuery(["cats"], 1, 10));

		expect(mockTagService.resolveTagIds.calledWith(["cats"])).to.be.true;
		expect(mockPostSearchLookup.findByTags.calledWith(["t1", "t2"])).to.be.true;
		expect(result.data).to.deep.equal([{ publicId: "p2" }]);
	});
});
