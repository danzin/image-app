import { BloomFilterOptions } from "@/services/bloom-filter.service";

const toPositiveInteger = (value: string | undefined, fallback: number): number => {
	const parsed = Number(value);
	if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
	return Math.floor(parsed);
};

const toRate = (value: string | undefined, fallback: number): number => {
	const parsed = Number(value);
	if (!Number.isFinite(parsed) || parsed <= 0 || parsed >= 1) return fallback;
	return parsed;
};

export const USERNAME_BLOOM_KEY = process.env.BLOOM_USERNAME_KEY || "bf:usernames:v1";
export const USERNAME_BLOOM_OPTIONS: BloomFilterOptions = {
	expectedItems: toPositiveInteger(process.env.BLOOM_USERNAME_EXPECTED_ITEMS, 500_000),
	falsePositiveRate: toRate(process.env.BLOOM_USERNAME_FALSE_POSITIVE_RATE, 0.001),
};

export const POST_VIEW_BLOOM_KEY_PREFIX = process.env.BLOOM_POST_VIEW_KEY_PREFIX || "bf:post-view:v1";
export const POST_VIEW_BLOOM_OPTIONS: BloomFilterOptions = {
	expectedItems: toPositiveInteger(process.env.BLOOM_POST_VIEW_EXPECTED_VIEWERS, 200_000),
	falsePositiveRate: toRate(process.env.BLOOM_POST_VIEW_FALSE_POSITIVE_RATE, 0.001),
};

export const POST_VIEW_BLOOM_TTL_SECONDS = toPositiveInteger(
	process.env.BLOOM_POST_VIEW_TTL_SECONDS,
	60 * 60 * 24 * 180,
);

export const getPostViewBloomKey = (postPublicId: string): string => `${POST_VIEW_BLOOM_KEY_PREFIX}:${postPublicId}`;
