# Cache Invalidation Strategy

## Event Flow Diagram

```
┌─────────────────┐
│  User Action    │
│  (Upload/Like/  │
│   Comment/etc)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Command Handler │
│ (DB Transaction)│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ EventBus.queue  │
│ Transactional   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Event Handler  │
│ (Post-Commit)   │
└────────┬────────┘
         │
         ├─────────────────┐
         │                 │
         ▼                 ▼
┌──────────────┐   ┌──────────────┐
│Tag-Based     │   │Pattern-Based │
│Invalidation  │   │Cleanup       │
└──────┬───────┘   └──────┬───────┘
       │                  │
       └─────────┬────────┘
                 │
                 ▼
        ┌────────────────┐
        │ Redis.publish  │
        │ (WebSocket)    │
        └────────────────┘
```

## Overview

The application uses **tag-based cache invalidation** for optimal performance. This approach is:

- **Efficient**: Only invalidates affected cache entries, not entire patterns
- **Non-blocking**: Uses Redis SCAN and batch operations
- **Automatic**: Triggers on events without manual intervention
- **Scalable**: Handles hundreds of users without overwhelming Redis

## How It Works

### 1. Cache Storage with Tags

When data is cached, it associated with semantic tags. **Important**: Tag metadata has the same TTL as the cache key to prevent orphaned tags.

```typescript
// Example: Caching a user's personalized feed
await redisService.setWithTags(
	`core_feed:${userId}:${page}:${limit}`,
	feedData,
	[
		`user_feed:${userId}`, // user-specific tag
		`feed_page:${page}`, // pagination tag
		`feed_limit:${limit}`, // limit tag
	],
	300 // TTL: 5 minutes (applied to cache AND tags)
);
```

### 2. Tag Storage Structure

Redis stores two types of mappings:

- **`tag:X`** → List of all cache keys associated with tag X
- **`key_tags:Y`** → List of all tags associated with cache key Y

Example:

```
tag:user_feed:user123 → ["core_feed:user123:1:5", "core_feed:user123:2:5"]
key_tags:core_feed:user123:1:5 → ["user_feed:user123", "feed_page:1", "feed_limit:5"]
```

### 3. Automatic Invalidation on Events

#### Image Deletion (`ImageDeleteHandler`)

When an image is deleted: **hybrid approach**:

1. Tag-based invalidation (fast, for active cache)
2. Pattern-based cleanup (thorough, for edge cases)

This ensures cache is cleared even if tag metadata has expired.

```typescript
// Step 1: Tag-based invalidation (O(tags))
const tagsToInvalidate = [
	"trending_feed",
	"new_feed",
	`user_feed:${uploaderId}`,
	`user_for_you_feed:${uploaderId}`,
	...followers.map((id) => `user_feed:${id}`),
	...followers.map((id) => `user_for_you_feed:${id}`),
];
await redis.invalidateByTags(tagsToInvalidate);

// Step 2: Pattern-based cleanup (O(keys))
const patterns = [
	`core_feed:${uploaderId}:*`,
	`for_you_feed:${uploaderId}:*`,
	"trending_feed:*",
	"new_feed:*",
	...followers.map((id) => `core_feed:${id}:*`),
	...followers.map((id) => `for_you_feed:${id}:*`),
];
await redis.deletePatterns(patterns);
```

**Performance**: For 100 followers, this takes ~10-20ms total.

#### Image Upload (`ImageUploadHandler`)

When a new image is uploaded, use the same hybrid approach:

1. Invalidates global discovery feeds (trending, new)
2. Invalidates uploader's personalized feeds
3. Invalidates all followers' feeds
4. Invalidates feeds of users interested in the image's tags

```typescript
// Tag-based invalidation
const tagsToInvalidate = [
	"trending_feed",
	"new_feed",
	`user_feed:${uploaderId}`,
	`user_for_you_feed:${uploaderId}`,
	...followers.map((id) => `user_feed:${id}`),
	...followers.map((id) => `user_for_you_feed:${id}`),
	...tagInterestedUsers.map((id) => `user_feed:${id}`),
	...tagInterestedUsers.map((id) => `user_for_you_feed:${id}`),
];
await redis.invalidateByTags(tagsToInvalidate);

// Pattern-based cleanup
const patterns = [
	`core_feed:${uploaderId}:*`,
	`for_you_feed:${uploaderId}:*`,
	"trending_feed:*",
	"new_feed:*",
	...followers.map((id) => `core_feed:${id}:*`),
	...followers.map((id) => `for_you_feed:${id}:*`),
];
await redis.deletePatterns(patterns);
```

**Performance**: Similar to deletion - ~10-20ms for 100 affected users.

**Real-time notifications**: Publishes WebSocket events so followers see new images instantly.

#### User Interactions (`FeedInteractionHandler`)

**Like/Unlike Events**: Only updates metadata, minimal invalidation

- Updates per-image like count in metadata cache
- Invalidates only the acting user's feeds (for personalization reordering)

**Comment Events**: Broader invalidation

- Invalidates acting user's feeds
- Invalidates followers' feeds who might see the comment

#### Follow/Unfollow (`FollowService`)

When a user follows/unfollows someone:

- Invalidates only that user's personalized feeds
- Global feeds (trending, new) are unaffected

```typescript
await redis.invalidateByTags([`user_feed:${userId}`, `user_for_you_feed:${userId}`]);
```

## Feed Cache Keys

### Personalized Feed

- **Key Pattern**: `core_feed:{userId}:{page}:{limit}`
- **Tags**: `user_feed:{userId}`, `feed_page:{page}`, `feed_limit:{limit}`
- **TTL**: 5 minutes
- **Invalidation**: On image deletion by followed users, likes, comments, follow/unfollow

### For You Feed

- **Key Pattern**: `for_you_feed:{userId}:{page}:{limit}`
- **Tags**: `user_for_you_feed:{userId}`, `for_you_feed_page:{page}`, `for_you_feed_limit:{limit}`
- **TTL**: 5 minutes
- **Invalidation**: On image deletion, user follows/unfollows

### Trending Feed

- **Key Pattern**: `trending_feed:{page}:{limit}`
- **Tags**: `trending_feed`, `page:{page}`, `limit:{limit}`
- **TTL**: 2 minutes
- **Invalidation**: On image deletion, new likes (affects ranking)

### New Feed

- **Key Pattern**: `new_feed:{page}:{limit}`
- **Tags**: `new_feed`, `page:{page}`, `limit:{limit}`
- **TTL**: 1 minute
- **Invalidation**: On image deletion

## Performance Characteristics

### Tag-Based Invalidation (`invalidateByTags`)

1. **Lookup phase**: O(T) where T = number of tags

   - Reads tag mappings from Redis
   - Collects unique keys to delete

2. **Deletion phase**: O(K/100) where K = number of keys
   - Deletes keys in batches of 100
   - Non-blocking batch operations

**Example**: Invalidating feeds for user with 50 followers

- Tags: ~100 (2 per user)
- Keys affected: ~200
- Redis operations: ~102 (100 reads + 2 batch deletes)
- Time: ~5-10ms

### Pattern-Based Invalidation (OLD - DEPRECATED)

**Don't use**: `redis.del("core_feed:*")` or `deletePatterns(["core_feed:*"])`

Problems:

- Uses SCAN which can iterate thousands of keys
- Deletes ALL user feeds, not just affected ones
- Can take 50-500ms depending on database size

## Manual Cache Clearing (Admin)

Admins can manually clear cache via the admin panel:

**Endpoint**: `DELETE /api/admin/cache?pattern=all_feeds`

**What it clears**:

```typescript
const patterns = [
	"core_feed:*", // all personalized feeds
	"for_you_feed:*", // all for-you feeds
	"trending_feed:*", // trending feed
	"new_feed:*", // new feed
	"tag:*", // all tag mappings
	"key_tags:*", // all key-tag mappings
];
```

**Performance**: Uses batched SCAN operations, takes ~50-200ms depending on cache size.

**When to use**:

- Cache corruption suspected
- Testing cache behavior
- Major data migrations
- Emergency cache flush

  **Normal operations should NEVER require manual cache clearing** - automatic invalidation handles everything.

## Best Practices

### DO

- Use tag-based invalidation for targeted cache clearing
- Include semantic tags when caching (user IDs, feed types, etc.)
- Batch delete operations (100 keys at a time)
- Set appropriate TTLs (1-5 minutes for feeds)
- Log invalidation operations for debugging

### DON'T

- Use wildcard pattern deletion (`del("feed:*")`)
- Delete keys one-by-one in loops
- Skip TTLs (prevents stale data accumulation)
- Invalidate more than necessary
- Block Redis with synchronous operations

## Monitoring

Key metrics to track:

1. **Cache hit rate**: `getWithTags` hits vs misses
2. **Invalidation frequency**: How often tags are invalidated
3. **Invalidation scope**: Average keys deleted per invalidation
4. **Redis memory**: Monitor for growth (indicates TTL issues)
