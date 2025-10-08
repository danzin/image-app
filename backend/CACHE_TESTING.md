# Cache Invalidation Testing Guide

This document provides step-by-step testing scenarios to verify automatic cache invalidation works correctly.
It assumes working in Linux environment(WSL or native Linux OS).
All the testing here is done on Ubuntu in WSL while development takes place on Windows.

## Prerequisites

1. Backend, Gateway, and Frontend running (`npm run dev`)
2. MongoDB and Redis running
3. At least 2 test users (one follows the other)
4. Redis CLI access via WSL: `"redis-cli ..."`

## Test Scenario 1: Image Upload - Instant Appearance

**What to test**: New images appear instantly in followers' feeds

### Steps:

1. **Setup**:

   - User A follows User B
   - User B has no images yet

2. **Check initial cache**:

   ```bash
   "redis-cli --scan --pattern 'core_feed:*' | wc -l"
   ```

   Note the count.

3. **User B uploads an image**:

   - Login as User B
   - Upload an image with tags (e.g., `nature`, `landscape`)
   - Check backend logs for: `[IMAGE_UPLOAD_HANDLER] Cache invalidation complete`

4. **Verify cache invalidation**:

   ```bash
   "redis-cli --scan --pattern 'core_feed:*' | wc -l"
   ```

   Count should be lower (User A's feed + global feeds invalidated)

5. **User A checks feed**:

   - Login as User A
   - Navigate to "For You" feed
   - **Expected**: User B's new image appears immediately (no refresh needed if WebSocket works)
   - **Manual refresh**: Image must appear within 1 second

6. **Check cache rebuild**:
   ```bash
   "redis-cli --scan --pattern 'core_feed:*' | wc -l"
   ```
   Count should increase (feed regenerated for User A)

### Expected Logs:

```
[IMAGE_UPLOAD_HANDLER] New image uploaded by <userB-id>, invalidating relevant feeds
[IMAGE_UPLOAD_HANDLER] Getting followers for user: <userB-id>
[IMAGE_UPLOAD_HANDLER] Found 1 followers
[IMAGE_UPLOAD_HANDLER] Total affected users: 1
[IMAGE_UPLOAD_HANDLER] Invalidating cache with X tags
[Redis] Deleted Y keys matching pattern: core_feed:<userA-id>:*
[IMAGE_UPLOAD_HANDLER] Cache invalidation complete for new image upload
```

### What's Invalidated:

- User B's own feeds (core_feed, for_you_feed)
- User A's feeds (follower)
- Global discovery feeds (trending_feed, new_feed)
- Anyone interested in `nature` or `landscape` tags

---

## Test Scenario 2: Image Deletion - Instant Removal

**What to test**: Deleted images disappear instantly from all feeds

### Steps:

1. **Setup**:

   - User B has an image that appears in User A's feed
   - Navigate to feed and confirm image is visible

2. **Check current cache**:

   ```bash
   "redis-cli GET core_feed:<userA-id>:1:5"
   ```

   Should return JSON with the image

3. **Delete the image**:

   - Login as admin
   - Go to Admin Panel → Images tab
   - Delete User B's image
   - Check logs for: `Image deleted: <imageId> by <userB-id>, invalidating relevant feeds`

4. **Verify immediate removal**:

   - Switch to User A's feed
   - **Expected**: Image disappears instantly (WebSocket) or after refresh
   - **Manual test**: Refresh feed - image must be gone

5. **Verify cache cleared**:
   ```bash
   "redis-cli GET core_feed:<userA-id>:1:5"
   ```
   Should return `(nil)` (cache cleared) or new data without the deleted image

### Expected Logs:

```
Image deleted: <imageId> by <userB-id>, invalidating relevant feeds
Invalidating feeds for 1 followers
Invalidating cache with X tags
[Redis] Deleted Y keys matching pattern: core_feed:<userA-id>:*
[Redis] Deleted Z keys matching pattern: trending_feed:*
Feed invalidation complete for image deletion
```

### What's Invalidated:

- User B's feeds (uploader)
- All followers' feeds
- Global feeds (trending, new)

---

## Test Scenario 3: Follow/Unfollow - Feed Updates

**What to test**: Following someone immediately shows their content

### Steps:

1. **Setup**:

   - User A does NOT follow User C
   - User C has several images

2. **User A follows User C**:

   - Login as User A
   - Navigate to User C's profile
   - Click "Follow"
   - Check logs for: `Invalidated feed cache for user <userA-id> after follow/unfollow action`

3. **Verify feed update**:

   - Navigate to "For You" feed
   - **Expected**: User C's images now appear in the feed

4. **Unfollow**:
   - Unfollow User C
   - Navigate to feed
   - **Expected**: User C's images disappear from feed

### Expected Logs:

```
Invalidated feed cache for user <userA-id> after follow/unfollow action
```

### What's Invalidated:

- User A's personalized feeds only
- NOT global feeds (efficient)
- NOT other users' feeds

---

## Test Scenario 4: Like/Comment - Smart Invalidation

**What to test**: Likes update metadata without structural changes

### Steps:

1. **Setup**:

   - User A views an image with 5 likes

2. **User A likes the image**:

   - Click like button
   - **Expected**: Like count updates to 6 instantly

3. **Check cache behavior**:

   - Backend logs should show: `Selective invalidation done (actor only) for like/unlike`
   - Only User A's feed invalidated (for personalization reordering)
   - Other users see updated like count via metadata overlay

4. **User A comments**:
   - Add a comment
   - **Expected**: Comment count updates, comments appear

### Expected Logs (Like):

```
Smart cache handling for interaction: like on image <imageId>
Selective invalidation done (actor only) for like/unlike; others rely on meta overlay
```

### Expected Logs (Comment):

```
Smart cache handling for interaction: comment on image <imageId>
Invalidating feeds for X affected users (non-like event)
```

### What's Invalidated:

**Like**:

- Acting user's feed only (for reordering)
- Image metadata updated (like count)

**Comment**:

- Acting user's feed
- Image owner's followers' feeds

---

## Test Scenario 5: Tag-Based Discovery

**What to test**: Users interested in tags see new content

### Steps:

1. **Setup**:

   - User A has liked/viewed several `nature` images (builds tag preference)
   - User B uploads a `nature` image
   - User A does NOT follow User B

2. **Check tag preferences**:

   ```bash
   # Check if User A has nature tag preference
   "redis-cli --scan --pattern 'tag:*nature*'"
   ```

3. **User B uploads image with `nature` tag**:

   - Upload completes
   - Check logs: `Found X users interested in tags`

4. **User A checks "For You" feed**:
   - **Expected**: User B's nature image appears (tag-based discovery)

### What's Invalidated:

- All users with `nature` tag preferences
- Global discovery feeds

---

## Performance Benchmarks

### Expected Invalidation Times:

| Scenario               | Followers | Affected Users | Time    | Redis Ops |
| ---------------------- | --------- | -------------- | ------- | --------- |
| Upload (no followers)  | 0         | 1              | 2-5ms   | ~10       |
| Upload (10 followers)  | 10        | 11             | 5-10ms  | ~50       |
| Upload (100 followers) | 100       | 101            | 10-20ms | ~300      |
| Delete (100 followers) | 100       | 101            | 10-20ms | ~300      |
| Like                   | N/A       | 1              | 1-2ms   | ~5        |
| Follow                 | N/A       | 1              | 2-5ms   | ~10       |

### Redis Key Lifecycle:

1. **Cache miss** → Feed generated → Stored with tags → TTL set
2. **Cache hit** → Feed served from cache → No DB query
3. **Event occurs** → Tags invalidated → Pattern cleanup → Keys deleted
4. **Next request** → Cache miss → Feed regenerates with fresh data

### Monitoring Commands:

```bash
# Total keys in Redis
 "redis-cli DBSIZE"

# Feed cache keys only
 "redis-cli --scan --pattern 'core_feed:*' | wc -l"

# Tag metadata keys
 "redis-cli --scan --pattern 'tag:*' | wc -l"

# Check specific user's feed cache
 "redis-cli --scan --pattern 'core_feed:<userId>:*'"

# Check feed data
 "redis-cli GET 'core_feed:<userId>:1:5'"

# Check tag metadata
 "redis-cli GET 'tag:user_feed:<userId>'"

# Monitor real-time operations
 "redis-cli MONITOR"
```

---

## Troubleshooting

### Problem: New images don't appear after upload

**Diagnosis**:

```bash
# Check if event fired
# Look for [IMAGE_UPLOAD_HANDLER] in backend logs

# Check if cache was invalidated
 "redis-cli --scan --pattern 'core_feed:*'"
# Should show reduced count immediately after upload

# Check if handler is registered
# Search container.ts for ImageUploadHandler
```

**Solutions**:

- Verify EventBus is publishing ImageUploadedEvent
- Check ImageUploadHandler is registered in DI container
- Verify Redis connection (check for Redis errors in logs)

### Problem: Deleted images still appear in feeds

**Diagnosis**:

```bash
# Check if deletion event fired
# Look for "Image deleted:" in backend logs

# Manually check Redis
 "redis-cli --scan --pattern '*<imageId>*'"
# Should return nothing

# Check feed cache
 "redis-cli GET 'core_feed:<userId>:1:5'"
# Parse JSON and search for deleted imageId
```

**Solutions**:

- Use admin cache clear button as workaround
- Check ImageDeleteHandler logs for errors
- Verify pattern matching is working (check Redis logs)

### Problem: Cache keys keep accumulating

**Diagnosis**:

```bash
# Check total keys over time
"redis-cli DBSIZE"
# Should stay relatively stable (< 200)

# Check TTLs
"redis-cli TTL 'core_feed:<userId>:1:5'"
# Should return positive number or -2 (expired)

# Check tag metadata
"redis-cli --scan --pattern 'tag:*' | wc -l"
# Should be similar to feed key count
```

**Solutions**:

- Verify setWithTags is setting TTLs on tag metadata
- Check for infinite loops creating cache entries
- Manually flush: `"redis-cli FLUSHDB"`

### Problem: Feeds are slow to load

**Diagnosis**:

- Check for "cache hit" vs "cache miss" in logs
- High cache miss rate = feeds regenerating too often
- Check TTL settings (should be 1-5 minutes)

**Solutions**:

- Increase TTLs if invalidation is too aggressive
- Add database indexes for feed queries
- Check for N+1 queries in feed enrichment

---

## Success Criteria

**Upload Test**: New image appears in followers' feeds within 1 second
**Delete Test**: Deleted image disappears from all feeds within 1 second
**Follow Test**: Following shows new content within 1 second
**Performance**: Invalidation completes in < 20ms for 100 affected users
**Cache Health**: Redis key count stays stable (< 200 keys)
**Tag Cleanup**: No orphaned tag metadata (tag count ≈ feed key count)
**Real-time**: WebSocket events trigger instant UI updates (no manual refresh)
