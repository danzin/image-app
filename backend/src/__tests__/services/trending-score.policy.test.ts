import { expect } from "chai";
import { describe, it } from "mocha";
import type { FeedPost } from "@/types";
import {
  buildTrendingScoreStages,
  calculateTrendingScore,
  DEFAULT_TRENDING_SCORE_WEIGHTS,
  resolveTrendingScoreWeights,
} from "@/services/feed/trending-score.policy";

describe("trending score policy", () => {
  it("calculates the shared worker score deterministically", () => {
    const createdAt = new Date("2024-01-01T00:00:00.000Z");
    const now = new Date("2024-01-02T00:00:00.000Z").getTime();
    const post = {
      publicId: "post-1",
      createdAt,
      likes: 3,
      commentsCount: 1,
      viewsCount: 2,
    } as FeedPost;

    const result = calculateTrendingScore(post, now);
    const expected =
      DEFAULT_TRENDING_SCORE_WEIGHTS.recency * 0.5 +
      DEFAULT_TRENDING_SCORE_WEIGHTS.popularity * Math.log(4) +
      DEFAULT_TRENDING_SCORE_WEIGHTS.comments * Math.log(2);

    expect(result.ageDays).to.equal(1);
    expect(result.recencyScore).to.equal(0.5);
    expect(result.score).to.be.closeTo(expected, 1e-12);
    expect(result.views).to.equal(2);
  });

  it("uses the same resolved weights in Mongo score stages", () => {
    const weights = resolveTrendingScoreWeights({ popularity: 0 });
    const stages = buildTrendingScoreStages(
      new Date("2024-01-02T00:00:00.000Z"),
      weights,
    );
    const scoreStage = stages[1] as {
      $addFields: {
        trendScore: {
          $add: Array<{ $multiply: [number, string] }>;
        };
      };
    };

    expect(weights).to.deep.equal({
      recency: 0.4,
      popularity: 0,
      comments: 0.1,
    });
    expect(scoreStage.$addFields.trendScore.$add).to.deep.equal([
      { $multiply: [weights.recency, "$recencyScore"] },
      { $multiply: [weights.popularity, "$popularityScore"] },
      { $multiply: [weights.comments, "$commentsScore"] },
    ]);
  });
});
