import { BloomFilterOptions } from "@/services/redis/bloom-filter.service";

const toPositiveInteger = (
  value: string | undefined,
  fallback: number,
): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
};

const toRate = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed >= 1) return fallback;
  return parsed;
};

export const USERNAME_BLOOM_KEY =
  process.env.BLOOM_USERNAME_KEY || "bf:usernames:v1";
export const USERNAME_BLOOM_OPTIONS: BloomFilterOptions = {
  expectedItems: toPositiveInteger(
    process.env.BLOOM_USERNAME_EXPECTED_ITEMS,
    500_000,
  ),
  falsePositiveRate: toRate(
    process.env.BLOOM_USERNAME_FALSE_POSITIVE_RATE,
    0.001,
  ),
};

export const GLOBAL_POST_VIEW_BLOOM_PREFIX =
  process.env.BLOOM_GLOBAL_POST_VIEW_PREFIX || "bf:global-post-views:v1";

export const POST_VIEW_BLOOM_OPTIONS: BloomFilterOptions = {
  // Use a global daily bloom filter to drastically reduce memory.
  // 1 million items at 1% FPR takes ~1.19MB instead of huge overhead per-post.
  expectedItems: toPositiveInteger(
    process.env.BLOOM_POST_VIEW_EXPECTED_VIEWERS,
    1_000_000,
  ),
  falsePositiveRate: toRate(
    process.env.BLOOM_POST_VIEW_FALSE_POSITIVE_RATE,
    0.01,
  ),
};

export const POST_VIEW_BLOOM_TTL_SECONDS = toPositiveInteger(
  process.env.BLOOM_POST_VIEW_TTL_SECONDS,
  60 * 60 * 48, // 48 hours is enough for a rolling daily key
);

export const getPostViewBloomKey = (): string => {
  const dateStr = new Date().toISOString().split("T")[0];
  return `${GLOBAL_POST_VIEW_BLOOM_PREFIX}:${dateStr}`;
};
