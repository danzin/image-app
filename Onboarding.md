# Peek social – Developer Onboarding

## Welcome

This is a full-stack social media platform with real-time features, built with TypeScript throughout.

## Architecture at a Glance

**Hybrid System**: We're actively migrating from a traditional service layer to CQRS (Command Query Responsibility Segregation). You'll encounter both patterns - this is intentional and ongoing.

**Tech Stack**:

- **Backend**: Node.js + Express, MongoDB (Mongoose), Redis, Socket.io, TSyringe for DI
- **Frontend**: React 18, Vite, React Query, TailwindCSS, MUI components
- **Edge Proxy**: Nginx handles load balancing, static file serving, API routing, and WebSocket proxying
- **Tooling**: npm workspaces, TypeScript project references, Mocha/Chai tests, Cypress E2E

## Getting Started

### Quick Setup (Docker - Recommended)

```bash
# 1. Clone and install dependencies
npm install

# 2. Configure environment variables (see root README.md for template)
# Create .env files in backend/ and frontend/

# 3. Start everything
docker-compose up --build
```

This brings up MongoDB (replica set), Redis, backend, and frontend (Nginx).

### Scaling the Backend

Nginx load-balances across all backend instances using `least_conn`. To scale horizontally:

```bash
docker-compose up --scale backend=4 -d
```

The backend has no external port mapping - all traffic is routed through Nginx on port 80. Socket.IO uses the `@socket.io/redis-adapter` to synchronize events across instances.

### Manual Setup (For Debugging)

If you need to run services individually:

```bash
# Ensure MongoDB replica set (port 27017) and Redis (6379) are running
npm run start-backend   # Backend only
npm run start-frontend  # Frontend only
```

**Important**: Backend requires MongoDB replica set for transactions. Use Docker for easiest setup, or configure replica set manually per `mongo-rs-init.sh`.

### Environment Variables

- `CLOUDINARY_*`: Optional. Without these, the system falls back to local file storage
- `VITE_API_URL`: Must point to your backend/Nginx for frontend to connect
- Check root `README.md` for complete template

## Project Structure

```
root/
├── backend/           # Node.js API server
│   ├── src/
│   │   ├── di/container.ts              # DI + CQRS registration (start here)
│   │   ├── application/
│   │   │   ├── commands/                # CQRS command handlers
│   │   │   ├── queries/                 # CQRS query handlers
│   │   │   └── events/                  # CQRS event handlers
│   │   ├── workers/                     # Background worker entry points
│   │   │   └── trending.worker.ts       # Bootstrap for the worker implementation
│   │   │   └── _impl/                   # Full worker implementation
│   │   ├── services/                    # Legacy services (being migrated)
│   │   ├── repositories/               # Data access layer
│   │   ├── models/                      # Mongoose schemas
│   │   ├── config/bloomConfig.ts        # Bloom filter tuning (username + post views)
│   │   └── server/
│   │       ├── server.ts                # Main server (CORS, rate limiting, routes)
│   │       └── socketServer.ts          # WebSocket + Redis adapter initialization
│   └── uploads/                         # Local image storage fallback
├── frontend/          # React SPA
│   ├── src/
│   │   ├── hooks/posts/usePosts.ts      # Feed infinite scroll hooks (cursor-based)
│   │   ├── components/                  # React components
│   │   ├── screens/                     # Route-level views
│   │   ├── api/                         # REST API clients
│   │   └── context/                     # Auth + Socket providers
│   └── nginx.conf                       # Load balancer + reverse proxy config
└── docker-compose.yml                   # Local development stack
```

## Key Concepts

### Backend Architecture

The backend consists of two main process types that share the same codebase: the API Server and Background Workers.

#### API Server

The main entry point (main.ts) that runs an Express server. It's responsible for handling all incoming HTTP requests from users. Its goal is to respond as quickly as possible.

CORS validation, rate limiting, and Prometheus metrics are handled directly in the backend's middleware pipeline (`server.ts`). Nginx sits in front as the edge load balancer and reverse proxy.

#### Background Workers

These are separate, headless Node.js processes (e.g., trending.worker.ts) that run alongside the main API server. They have no API endpoints.

Purpose: To handle slow, computationally expensive, or asynchronous tasks without blocking the main API server. This makes the user-facing API much faster and more resilient.

- **Trending Feed Worker:**
  - Listens to a Durable Stream: It subscribes to a Redis Stream called stream:interactions.
    - Receives Events: The main API server pushes small "interaction events" (like, comment) to this stream whenever a user interacts with a post. This is a fast, "fire-and-forget" operation for the API.

  - Processes in Batches: The worker consumes these events, batches them together over a few seconds, and fetches the latest data from MongoDB.

  - Calculates and Caches: It calculates the trendScore for each affected post and writes the result to a Redis Sorted Set (trending:global).

  - Resilience: By using a Redis Stream with consumer groups, if the worker crashes, it can restart and continue processing events exactly where it left off, ensuring no interactions are lost.

This decouples the real-time trending calculation from the user request cycle, which is a critical pattern for scalability.

#### CQRS Migration (In Progress)

We're transitioning to CQRS for better scalability and separation of concerns:

- **Commands**: Write operations (create, update, delete)
- **Queries**: Read operations (fetch data)
- **Events**: React to domain events (feed updates, notifications)

**Current State**: Many routes still use legacy service layer. New features should use CQRS; existing features can be migrated opportunistically.

#### Dependency Injection

TSyringe manages all dependencies. Register new services in `backend/src/di/container.ts`:

```typescript
container.registerSingleton("YourService", YourService);
```

This keeps the codebase testable and modular.

#### Transaction Management

Use `UnitOfWork` for operations spanning multiple collections:

```typescript
await unitOfWork.executeInTransaction(async (session) => {
  // your database operations
  eventBus.queueTransactional(new SomeEvent(...), session);
});
```

Events are published automatically after transaction commits.

#### Real-time Updates

1. Backend publishes events to Redis channel `feed_updates`
2. `RealTimeFeedService` subscribes and broadcasts via Socket.io
3. Frontend receives socket events and invalidates React Query cache

### Cursor-Based Feed Pagination

All feed types (personalized, trending, new, for-you) use **cursor-based pagination** instead of traditional skip/offset. This is the system's primary pagination strategy.

#### What is a Cursor?

A cursor is a Base64-encoded JSON object containing the compound sort key of the last item on the current page. It acts as a bookmark - instead of saying "skip 200 items", it says "give me items after this specific point".

Each feed type encodes different fields depending on its sort order:

| Feed Type | Cursor Fields | Sort Key |
|---|---|---|
| New (chronological) | `{ createdAt, _id }` | `createdAt DESC, _id DESC` |
| Trending | `{ trendScore, _id }` | `trendScore DESC, _id DESC` |
| Ranked (for-you) | `{ rankScore, _id }` | `rankScore DESC, _id DESC` |
| Personalized | `{ phase, createdAt, _id }` | `createdAt DESC, _id DESC` + phase tracking |

Using `_id` as a tiebreaker guarantees deterministic ordering even when multiple posts share the same score or timestamp.

#### How the Cursor Flows: Frontend to Backend

**1. Frontend initiates a request** (`frontend/src/hooks/posts/usePosts.ts`)

React Query's `useInfiniteQuery` manages pagination. On the first request, no cursor is sent. On subsequent pages, the cursor from the previous response is passed as `pageParam`:

```typescript
queryFn: async ({ pageParam = 1 }) => {
  // pageParam is either 1 (first page) or a cursor string (subsequent pages)
  const response = await fetchPersonalizedFeed(pageParam, limit);
  return response;
},
getNextPageParam: (lastPage) => {
  if (lastPage.hasMore === false) return undefined; // stop scrolling
  if (lastPage.nextCursor) return lastPage.nextCursor;
  return undefined;
},
```

**2. API layer sends the cursor** (`frontend/src/api/postApi.ts`)

If `pageParam` is a string (cursor), it's sent as `?cursor=...`. If it's a number, it's sent as `?page=...` for backward compatibility:

```typescript
if (typeof pageParam === 'string') {
  params.set('cursor', pageParam);
} else {
  params.set('page', String(pageParam));
}
```

**3. Backend controller extracts the cursor** (`backend/src/controllers/feed.controller.ts`)

```typescript
const cursor = req.query.cursor as string | undefined;
const query = new GetPersonalizedFeedQuery(userId, page, limit, cursor);
```

**4. Repository decodes and applies the cursor** (`backend/src/repositories/post.repository.ts`)

The cursor is decoded from Base64 back into its structured form, then converted into a MongoDB `$match` filter:

```typescript
const decodedCursor = decodeCursor<{ createdAt?: string; _id?: string }>(options.cursor);
// Becomes a "give me items AFTER this point" filter:
cursorFilter = {
  $or: [
    { createdAt: { $lt: cursorDate } },
    { createdAt: cursorDate, _id: { $lt: cursorId } }
  ]
};
```

**5. Response includes the next cursor**

The backend fetches `limit + 1` items. If there are more than `limit` results, `hasMore = true` and a `nextCursor` is generated from the last item's sort key. The extra item is trimmed from the response.

#### Trending Feed Phase Transition

When the trending feed runs out of scored content, it seamlessly transitions to chronological (new) posts using a `new_phase:` cursor prefix. The handler detects this prefix and switches to `getNewFeedWithCursor` for all subsequent pages, providing an infinite timeline.

#### Personalized Feed Phases

The personalized feed uses a two-phase system encoded in the cursor:
- **`personalized` phase**: Fetches posts from followed users and favorite tags
- **`backfill` phase**: When personalized content is exhausted, backfills with general chronological posts

The phase is tracked inside the cursor itself, so the transition is stateless and transparent to the frontend.

### Bloom Filter Service

The system uses a custom Redis-backed **Bloom filter** (`backend/src/services/bloom-filter.service.ts`) for probabilistic membership testing. Bloom filters answer "is this item possibly in the set?" with configurable false-positive rates, avoiding expensive database lookups for common checks.

#### How It Works

The filter is built on Redis bit strings using `GETBIT`/`SETBIT` commands. Each item is hashed using a **double-hashing** scheme (SHA-256 + SHA-1) to produce `k` independent bit positions:

```
index[i] = (hash_a + i * hash_b) % bitSize
```

The bit array size and hash count are auto-computed from the desired `expectedItems` and `falsePositiveRate` using optimal formulas.

#### Where It's Used

| Use Case | Redis Key | Config | Purpose |
|---|---|---|---|
| **Post view deduplication** | `bf:post-view:v1:{postPublicId}` | 200K expected viewers, 0.1% FPR, 180-day TTL | Before recording a view, check if the user likely already viewed this post. Avoids a MongoDB query + transaction for repeat views |
| **Username availability** | `bf:usernames:v1` | 500K expected items, 0.1% FPR | Fast pre-check during registration. If the bloom says "not seen", the username is definitely available without hitting the DB |

Configuration lives in `backend/src/config/bloomConfig.ts` and is tunable via environment variables.

#### Important: False Positives

Bloom filters can return **false positives** (saying an item exists when it doesn't) but **never false negatives**. The system handles this gracefully:
- For post views: A false positive means occasionally skipping a legitimate first view (acceptable trade-off vs. saving thousands of DB queries)
- For usernames: A false positive means the system falls back to a real database check

### Caching & Data Flow Patterns

The system uses several well-known distributed caching patterns. Understanding which pattern applies where will help you reason about data freshness, consistency trade-offs, and where to look when debugging.

#### Fan-Out-On-Write (Push Model)

When a user publishes a post, the system **pushes** the post ID into every follower's personal feed in Redis, rather than computing follower feeds on read.

```
User creates post
    |
    v
CreatePostCommandHandler (Mongo transaction)
    |
    v
EventBus -> PostCreatedEvent
    |
    v
FeedFanoutService.fanOutPostToFollowers()
    |  - Fetches all follower IDs
    |  - Batch-inserts postId into each follower's Redis Sorted Set (feed:for_you:{userId})
    v
When follower opens feed -> reads pre-built list from Redis sorted set
```

**Where**: `backend/src/services/feed/feed-fanout.service.ts`
**Trade-off**: Write amplification (1 post = N Redis writes for N followers), but reads become O(1) lookups instead of expensive "find all posts from people I follow" aggregations. Deletion also fans out (`removePostFromFollowers`).

#### Cache-Aside (Lazy Population)

Most feed reads use **cache-aside**: check Redis first, compute on miss, store result, return.

```
GET /api/feed/new
    |
    v
Redis GET core_feed key
    |
    +-- HIT  -> return cached core feed
    |
    +-- MISS -> run MongoDB aggregation
               -> store result in Redis with tags
               -> return fresh data
```

**Where**: `backend/src/services/feed/feed-read.service.ts` (all feed methods: `getPersonalizedFeed`, `getTrendingFeed`, `getNewFeed`)
**Invalidation**: Tag-based. Each cache entry is stored with `setWithTags()`, associating it with semantic tags like `user_feed:{userId}` or `trending_feed`. When a post is created/deleted, all entries matching the relevant tags are bulk-invalidated.

#### Read-Time Hydration (Core/Enrichment Split)

Feed data is split into two layers with different freshness guarantees:

1. **Core feed (cached, stale-OK)**: The expensive MongoDB aggregation result - post IDs, sort order, scores. Cached for 2-60 minutes depending on feed type
2. **Enrichment (always fresh)**: User avatars, handles, like counts, comment counts. Fetched from Redis on every read using batched `MGET`

```
Cached core feed: [postA, postB, postC]  (order is 5 minutes stale - acceptable)
                       |
                       v
FeedEnrichmentService.enrichFeedWithCurrentData()
    |
    +-- MGET user_data:{id} for all unique users    (1 Redis round-trip)
    +-- MGET post_meta:{id} for all unique posts    (1 Redis round-trip)
    |
    v
Return feed with fresh avatars, usernames, like counts
```

**Where**: `backend/src/services/feed-enrichment.service.ts`
**Why**: Users tolerate slightly stale feed ordering, but notice immediately if an avatar or like count is wrong. This pattern avoids re-running expensive aggregations while keeping visible data fresh.

#### Fire-and-Forget Event Streaming

User interactions (likes, comments, views) are recorded as lightweight events on a **Redis Stream** rather than triggering immediate recalculation:

```
User likes a post
    |
    v
API handler pushes event to Redis Stream (stream:interactions)
    |  (non-blocking, fire-and-forget)
    v
Request returns immediately to user
    ...
    (asynchronously)
    ...
Trending Worker (separate process)
    |  - Reads events from stream in batches (consumer group)
    |  - Aggregates interaction data
    |  - Recomputes trendScores
    |  - Updates Redis Sorted Set (trending:global)
    v
Next trending feed read picks up new scores
```

**Where**: Worker in `backend/src/workers/_impl/trending.worker.impl.ts`, stream publishing in interaction handlers
**Trade-off**: Trending scores are eventually consistent (seconds of lag), but the API never blocks on score computation. The Redis Stream with consumer groups provides at-least-once delivery and crash recovery.

#### Pre-Warming (Proactive Cache Population)

The system proactively fills caches before users request data, avoiding cold-start latency:

- **New feed prewarm**: A background worker calls `FeedFanoutService.prewarmNewFeed()` which pre-computes and caches the first 3 pages of the chronological feed using cursor-chained queries
- **Trending feed prewarm**: The trending worker's full-refresh cycle populates the `trending:global` sorted set, so the first user to request trending never hits a cache miss

**Where**: `backend/src/services/feed/feed-fanout.service.ts` (`prewarmNewFeed`), `backend/src/workers/_impl/trending.worker.impl.ts`

#### Adaptive TTL

Features like trending tags and "who to follow" don't use fixed cache durations. Instead, the `UserActivityService` measures real-time platform activity and selects a TTL tier: active platforms get 5-minute caches; quiet platforms get caches lasting up to 30 days. This prevents both stale-data problems on busy platforms and unnecessary recomputation on quiet ones.

**Where**: `backend/src/config/cacheConfig.ts` (TTL tiers), `backend/src/services/user-activity.service.ts` (activity measurement)

### Redis-Backed JWT Authentication

Authentication uses a **server-backed session model** where JWTs are paired with Redis-stored sessions for immediate revocation capability.

#### Token Architecture

```
Login
  |
  v
AuthService.login()
  |
  +-> Create Redis session (AuthSessionService)
  |     Key: session:{sid}
  |     Value: { publicId, refreshTokenHash, ip, userAgent, createdAt, lastAccessedAt }
  |     TTL: 30 days
  |
  +-> Generate access token (JWT, 15min)
  |     Payload: { publicId, email, handle, username, isAdmin, sid, jti, ver }
  |
  +-> Generate refresh token
  |     Format: {sid}.{48-byte-hex-secret}
  |
  v
Set cookies: accessToken (short-lived) + refreshToken (long-lived)
```

#### Key Design Decisions

- **Access tokens (15 min TTL)**: Short-lived JWTs containing claims. The `sid` field links back to the Redis session for validation
- **Refresh tokens (30 day TTL)**: Opaque tokens stored as SHA-256 hashes in Redis. On each refresh, the token is **rotated** (old token invalidated, new one issued)
- **Rotation grace period (15 min)**: After rotation, the previous refresh token is still accepted briefly to handle race conditions from concurrent requests
- **Session revocation**: Deleting the Redis session key instantly invalidates both the access and refresh tokens for that session
- **Per-user revocation**: `revokeAllSessionsForUser()` scans and deletes all sessions for a user (e.g., on password change)
- **Session touch**: On each authenticated request, `lastAccessedAt` is updated (throttled to once per minute to reduce Redis writes)

#### Auth Middleware Flow

```
Incoming Request
  |
  +-> Extract JWT from cookie or Authorization header
  |
  +-> Verify JWT signature + expiry
  |
  +-> Extract sid from JWT payload
  |
  +-> Validate session exists in Redis (AuthSessionService.assertAccessSession)
  |     - Session must exist, not be revoked, and match the user's publicId
  |
  +-> Touch session (update lastAccessedAt, throttled)
  |
  +-> Attach decodedUser to req.decodedUser
  |
  v
Route handler executes
```

### Frontend Architecture

#### Data Fetching

React Query is the single source of truth. Mutations invalidate specific query keys to trigger refetches:

```typescript
const mutation = useMutation({
	mutationFn: likeImage,
	onSuccess: () => {
		queryClient.invalidateQueries(["feed"]);
	},
});
```

#### Real-time Integration

`FeedSocketManager` (global component) + `useFeedSocketIntegration` hook handle socket events and cache invalidation automatically.

#### Styling

- **TailwindCSS**: Layout and utilities
- **MUI Components**: Complex UI elements (dialogs, dropdowns)
- Respect tokens in `src/theme/`

### Request Flow (Edge to Core)

```
Browser/Client
    |
    v
Nginx (frontend/nginx.conf)
    |  Static files -> served directly
    |  /api/* -> backend_pool (least_conn load balancing)
    |  /socket.io/* -> backend_pool (WebSocket upgrade)
    v
Backend (Express + CQRS)
    |  CORS + rate limiting + metrics (in server.ts middleware)
    |  Controllers -> CommandBus/QueryBus
    |  Redis cache + MongoDB
    v
Response -> Nginx -> Client
```

### CQRS + caching flow (reads)

```
GET /api/feed/new
    |
    v
FeedController -> QueryBus
    |
    v
GetNewFeedQueryHandler
    |
    +-> Redis cache hit? -> return cached core feed
    |
    +-> cache miss -> PostRepository aggregation -> cache core feed
    |
    v
FeedEnrichmentService -> DTOService -> response
```

### CQRS + caching flow (writes + fan-out)

```
POST /api/posts
    |
    v
PostController -> CommandBus
    |
    v
CreatePostCommandHandler
    |
    +-> UnitOfWork (Mongo transaction)
    |      - persist post
    |      - queue domain events
    |
    v
EventBus (post-commit)
    |
    +-> Redis stream / sorted sets
    +-> workers update trending scores
    |
    v
Redis-backed feeds updated, clients read cached feeds
```

## Important IDs and Conventions

- **MongoDB `_id`**: Internal database identifier
- **`publicId`**: UUID-like external identifier (used in DTOs and events)
- **`handler`**: external, non-mutable unique user identifier.

## Known Gotchas

### Technical Debt Markers

Look for `// TODO: REFACTOR AND REMOVE OLD METHODS` comments. These mark legacy code awaiting migration. Don't remove them without ensuring CQRS equivalent exists.

### Incomplete CQRS Coverage

Not all routes use CQRS yet. Check if a legacy service method is still in use before removing it.

### ESLint Configuration

Root `eslint.config.js` references `eslintPluginPrettier` without importing it. Lint may fail unless you have it globally.

### Redis + MongoDB Requirements

Backend won't start without Redis and MongoDB replica set. Use Docker to avoid configuration headaches.

## Debugging Tips

- **Logs**: Backend creates log files in `backend/*.log` (Pino + Winston). Tail these for troubleshooting

- **Socket debugging**: Check `backend/src/server/socketServer.ts` for authentication flow
- **Feed caching**: See `backend/src/services/redis.service.ts` and `feed.service.ts` for cache invalidation logic

## Useful Commands

```bash
npm run dev              # Start all services
npm run clean            # Clean build artifacts
npm run update:backend   # Update backend dependencies
npm run update:frontend  # Update frontend dependencies
```

## Resources

- **Root README.md**: High-level architecture and environment setup
- **docker-compose.yml**: Service configuration and ports
- **tsconfig.json**: Project references for multi-package builds

## Getting Help

When stuck:

1. Check if similar functionality exists (search for patterns)
2. Review `backend/src/di/container.ts` to see how services are wired
3. Inspect `docker-compose.yml` for service dependencies
4. Look at existing CQRS handlers for structural patterns
