import type { FeedPost } from "@/types";

export interface TrendingStreamClient {
  readonly isOpen: boolean;
  quit(): Promise<unknown>;
}

export interface TrendingStreamConfig {
  stream: string;
  group: string;
  consumer: string;
  readCount: number;
  reclaimMinIdleMs: number;
}

export interface TrendingStreamMessage {
  id: string;
  fields: Record<string, string>;
}

export interface TrendingProjectionUpdate {
  ageDays: number;
  comments: number;
  commentsScore: number;
  likes: number;
  popularityScore: number;
  postId: string;
  recencyScore: number;
  score: number;
  views: number;
}

export interface TrendingProjectionBatch {
  updates: TrendingProjectionUpdate[];
  missingPostIds: string[];
}

export interface ITrendingStreamStore {
  waitForConnection(timeoutMs: number): Promise<boolean>;
  ensureConsumerGroup(stream: string, group: string): Promise<void>;
  createClient(): Promise<TrendingStreamClient>;
  closeClient(client: TrendingStreamClient): Promise<void>;
  readGroup(
    client: TrendingStreamClient,
    config: TrendingStreamConfig,
  ): Promise<unknown>;
  acknowledge(
    stream: string,
    group: string,
    ids: readonly string[],
  ): Promise<void>;
  pendingRange(
    stream: string,
    group: string,
    count: number,
  ): Promise<unknown>;
  claim(
    config: TrendingStreamConfig,
    ids: readonly string[],
  ): Promise<unknown>;
}

export interface ITrendingCacheStore {
  writeUpdates(updates: readonly TrendingProjectionUpdate[]): Promise<void>;
}

export interface ITrendingStreamConsumer {
  initialize(
    config: TrendingStreamConfig,
    timeoutMs: number,
  ): Promise<TrendingStreamClient>;
  close(client: TrendingStreamClient): Promise<void>;
  read(
    client: TrendingStreamClient,
    config: TrendingStreamConfig,
  ): Promise<TrendingStreamMessage[]>;
  acknowledge(
    config: TrendingStreamConfig,
    ids: readonly string[],
  ): Promise<void>;
  findReclaimableMessageIds(
    config: TrendingStreamConfig,
    count: number,
  ): Promise<string[]>;
  claim(
    config: TrendingStreamConfig,
    ids: readonly string[],
  ): Promise<TrendingStreamMessage[]>;
}

export interface ITrendingProjectionService {
  findPostsByPublicIds(postIds: readonly string[]): Promise<FeedPost[]>;
  preparePendingUpdates(
    posts: unknown,
    postIds: readonly string[],
  ): TrendingProjectionBatch;
  prepareRefreshUpdates(posts: unknown): TrendingProjectionUpdate[];
  writeUpdates(updates: readonly TrendingProjectionUpdate[]): Promise<void>;
}
