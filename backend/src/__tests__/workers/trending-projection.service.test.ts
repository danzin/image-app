import "reflect-metadata";
import { expect } from "chai";
import sinon from "sinon";
import { TrendingProjectionService } from "@/workers/trending/trending-projection.service";
import type { ITrendingCacheStore } from "@/workers/trending/trending.ports";

describe("trending projection service", () => {
  afterEach(() => {
    sinon.restore();
  });

  it("loads, scores, and writes only the posts returned by the repository", async () => {
    const post = {
      publicId: "post-1",
      likes: 3,
      commentsCount: 1,
      viewsCount: 5,
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
    };
    const postReadRepository = {
      findPostsByPublicIds: sinon.stub().resolves([post]),
    };
    const cacheStore = {
      writeUpdates: sinon.stub().resolves(),
    } as sinon.SinonStubbedInstance<ITrendingCacheStore>;
    const service = new TrendingProjectionService(
      postReadRepository as any,
      cacheStore,
    );

    const posts = await service.findPostsByPublicIds([
      "post-1",
      "post-missing",
    ]);
    const projection = service.preparePendingUpdates(posts, [
      "post-1",
      "post-missing",
    ]);

    expect(projection.missingPostIds).to.deep.equal(["post-missing"]);
    expect(projection.updates).to.have.length(1);
    expect(projection.updates[0]).to.include({
      postId: "post-1",
      likes: 3,
      comments: 1,
      views: 5,
    });
    expect(projection.updates[0].score).to.be.a("number");

    await service.writeUpdates(projection.updates);
    sinon.assert.calledOnceWithExactly(
      cacheStore.writeUpdates,
      projection.updates,
    );
  });

  it("rejects malformed repository posts before cache writes", () => {
    const cacheStore = {
      writeUpdates: sinon.stub().resolves(),
    } as sinon.SinonStubbedInstance<ITrendingCacheStore>;
    const service = new TrendingProjectionService(
      {} as any,
      cacheStore,
    );

    expect(() =>
      service.preparePendingUpdates(
        [{ publicId: "" }],
        ["post-1"],
      ),
    ).to.throw(
      TypeError,
      "Malformed repository post during trending flush",
    );
    sinon.assert.notCalled(cacheStore.writeUpdates);
  });
});
