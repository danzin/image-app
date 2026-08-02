import { TrendingWorker } from "@/workers/_impl/trending.worker.impl";
import {
  RedisTrendingCacheStore,
  RedisTrendingStreamStore,
} from "@/workers/trending/redis-trending.store";
import { TrendingProjectionService } from "@/workers/trending/trending-projection.service";
import { TrendingStreamConsumer } from "@/workers/trending/trending-stream.consumer";

export function createTrendingWorker(
  feedReadDao: any,
  redisService: any,
  postReadRepository: any,
  metricsService?: any,
): TrendingWorker {
  return new TrendingWorker(
    feedReadDao,
    new TrendingStreamConsumer(
      new RedisTrendingStreamStore(redisService),
    ),
    new TrendingProjectionService(
      postReadRepository,
      new RedisTrendingCacheStore(redisService),
    ),
    metricsService,
  );
}
