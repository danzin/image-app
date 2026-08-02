import type { PipelineStage } from "mongoose";
import type { FeedPost } from "@/types";

export interface TrendingScoreWeights {
  recency: number;
  popularity: number;
  comments: number;
}

export interface TrendingScore {
  ageDays: number;
  comments: number;
  commentsScore: number;
  likes: number;
  popularityScore: number;
  recencyScore: number;
  score: number;
  views: number;
}

export const DEFAULT_TRENDING_SCORE_WEIGHTS: Readonly<TrendingScoreWeights> =
  Object.freeze({
    recency: 0.4,
    popularity: 0.5,
    comments: 0.1,
  });

export function resolveTrendingScoreWeights(
  overrides?: Partial<TrendingScoreWeights>,
): TrendingScoreWeights {
  return {
    recency: overrides?.recency ?? DEFAULT_TRENDING_SCORE_WEIGHTS.recency,
    popularity:
      overrides?.popularity ?? DEFAULT_TRENDING_SCORE_WEIGHTS.popularity,
    comments: overrides?.comments ?? DEFAULT_TRENDING_SCORE_WEIGHTS.comments,
  };
}

export function buildTrendingScoreStages(
  asOf: Date,
  weights: TrendingScoreWeights,
): PipelineStage[] {
  return [
    {
      $addFields: {
        recencyScore: {
          $divide: [
            1,
            {
              $add: [
                1,
                {
                  $divide: [
                    { $subtract: [asOf, "$createdAt"] },
                    1000 * 60 * 60 * 24,
                  ],
                },
              ],
            },
          ],
        },
        popularityScore: {
          $ln: {
            $add: [{ $max: [0, { $ifNull: ["$likesCount", 0] }] }, 1],
          },
        },
        commentsScore: {
          $ln: {
            $add: [{ $max: [0, { $ifNull: ["$commentsCount", 0] }] }, 1],
          },
        },
      },
    },
    {
      $addFields: {
        trendScore: {
          $add: [
            { $multiply: [weights.recency, "$recencyScore"] },
            { $multiply: [weights.popularity, "$popularityScore"] },
            { $multiply: [weights.comments, "$commentsScore"] },
          ],
        },
      },
    },
  ];
}

export function calculateTrendingScore(
  post: FeedPost,
  now = Date.now(),
): TrendingScore {
  if (
    !isRecord(post) ||
    typeof post.publicId !== "string" ||
    post.publicId.length === 0
  ) {
    throw new TypeError("Invalid post data for trending score");
  }

  const likes = post.likes ?? 0;
  const comments = post.commentsCount ?? 0;
  const views = post.viewsCount ?? 0;
  const createdAt = new Date(post.createdAt).getTime();
  if (
    typeof likes !== "number" ||
    !Number.isFinite(likes) ||
    likes < 0 ||
    typeof comments !== "number" ||
    !Number.isFinite(comments) ||
    comments < 0 ||
    typeof views !== "number" ||
    !Number.isFinite(views) ||
    views < 0 ||
    !Number.isFinite(createdAt)
  ) {
    throw new TypeError("Invalid post data for trending score");
  }

  const ageDays = (now - createdAt) / (1000 * 60 * 60 * 24);
  const recencyScore = 1 / (1 + ageDays);
  const popularityScore = Math.log(likes + 1);
  const commentsScore = Math.log(comments + 1);
  const weights = DEFAULT_TRENDING_SCORE_WEIGHTS;
  const score =
    weights.recency * recencyScore +
    weights.popularity * popularityScore +
    weights.comments * commentsScore;

  if (
    !Number.isFinite(ageDays) ||
    !Number.isFinite(recencyScore) ||
    !Number.isFinite(popularityScore) ||
    !Number.isFinite(commentsScore) ||
    !Number.isFinite(score)
  ) {
    throw new TypeError("Failed to compute trending score");
  }

  return {
    ageDays,
    comments,
    commentsScore,
    likes,
    popularityScore,
    recencyScore,
    score,
    views,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
