# Peek social – Developer Onboarding

## Welcome

This is a full-stack social media platform with real-time features, built with TypeScript throughout.

## Architecture at a Glance

**Hybrid System**: We're actively migrating from a traditional service layer to CQRS (Command Query Responsibility Segregation). You'll encounter both patterns—this is intentional and ongoing.

**Tech Stack**:

- **Backend**: Node.js + Express, MongoDB (Mongoose), Redis, Socket.io, TSyringe for DI
- **Frontend**: React 18, Vite, React Query, TailwindCSS, MUI components
- **API Gateway**: Express reverse proxy handling CORS and rate limiting
- **Tooling**: npm workspaces, TypeScript project references, Mocha/Chai tests, Cypress E2E

## Getting Started

### Quick Setup (Docker - Recommended)

```bash
# 1. Clone and install dependencies
npm install

# 2. Configure environment variables (see root README.md for template)
# Create .env files in backend/, frontend/, and api-gateway/

# 3. Start everything
docker-compose up --build
```

This brings up MongoDB (replica set), Redis, backend, API gateway, and frontend.

### Manual Setup (For Debugging)

If you need to run services individually:

```bash
# Ensure MongoDB replica set (port 27017) and Redis (6379) are running
npm run start-backend   # Backend only
npm run start-gateway   # API Gateway only
npm run start-frontend  # Frontend only
```

**Important**: Backend requires MongoDB replica set for transactions. Use Docker for easiest setup, or configure replica set manually per `mongo-rs-init.sh`.

### Environment Variables

- `CLOUDINARY_*`: Optional. Without these, the system falls back to local file storage
- `VITE_API_URL`: Must point to your API gateway/backend for frontend to connect
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
│   │   │   └── events/    							 # CQRS event handlers
│   │   ├── workers/                     # Background worker entry points
│   │   │   └── trending.worker.ts       # Bootstrap for the worker implementation
|		|   |   └── _impl/									 # Full worker implementation
│   │   ├── services/                    # Legacy services (being migrated)
│   │   ├── repositories/                # Data access layer
│   │   ├── models/                      # Mongoose schemas
│   │   └── server/socketServer.ts       # WebSocket initialization
|   |   |__ server/server.ts             # Main server intialization
│   └── uploads/                         # Local image storage fallback
├── frontend/          # React SPA
│   ├── src/
│   │   ├── hooks/feeds/                 # Feed + real-time hooks
│   │   ├── components/                  # React components
│   │   ├── screens/                     # Route-level views
│   │   ├── api/                         # REST API clients
│   │   └── context/                     # Auth + Socket providers
├── api-gateway/       # Express proxy
│   └── src/server.ts                    # Routing + rate limiting
└── docker-compose.yml # Local development stack
```

## Key Concepts

### Backend Architecture

The backend consists of two main process types that share the same codebase: the API Server and Background Workers.

#### API Server

The main entry point (main.ts) that runs an Express server. It's responsible for handling all incoming HTTP requests from users. Its goal is to respond as quickly as possible.

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

### API Gateway

Centralizes routing and cross-cutting concerns:

- Proxies `/api` requests to backend
- Applies rate limiting
- Handles CORS

Configure in `src/config.ts`.

## Development Workflow

### Making Changes

1. **Identify the layer**: Is this a command, query, or event? Or legacy service code?
2. **Register dependencies**: Add new services/handlers to `backend/src/di/container.ts`
3. **Write tests**: Unit tests in `backend/src/__tests__/`, E2E with Cypress
4. **Type check**: `npm run build` (or `npm run build --workspace=backend`)
5. **Lint**: `npm run lint` in frontend workspace

### Running Tests

```bash
npm run test-backend  # Mocha unit/integration tests
npm run test:e2e      # Cypress (requires running services)
```

### Common Tasks

- **Add a new endpoint**: Create CQRS handler → Register in container → Wire to controller
- **Add real-time feature**: Publish event in handler → Subscribe in `RealTimeFeedService` → Handle in frontend socket integration
- **Add a feed type**: Update `FeedService`, Redis keys, and frontend feed hooks

### Cursor-based feed pagination (new feed, trending, ranked)

The skip-based feed methods are deprecated for deep pagination. The new cursor methods avoid `skip()` scans by using a stable cursor (compound sort key) so page N fetches do not grow linearly with dataset size.

- `backend/src/repositories/post.repository.ts`
  - `getNewFeedWithCursor`: Uses `(createdAt, _id)` ordering and a cursor filter to paginate in O(1) relative to page depth. This avoids large skip scans and keeps ordering deterministic even when posts share the same timestamp.
  - `getTrendingFeedWithCursor`: Computes `trendScore` once, then applies a `(trendScore, _id)` cursor filter. This keeps deep trending pagination fast while preserving strict score ordering.
  - `getRankedFeedWithCursor`: Computes `rankScore` once with tag-match weighting, then pages by `(rankScore, _id)` cursor. This prevents deep pages from re-scanning large ranked sets.

- `backend/src/repositories/interfaces/IPostReadRepository.ts` + `backend/src/repositories/read/PostReadRepository.ts`
  - Cursor methods are now part of the read repository contract with typed `CursorPaginationResult`. This keeps CQRS handlers and workers on a single, efficient API and removes the need for ad-hoc casts to the base repository.

- `backend/src/workers/_impl/trending.worker.impl.ts`
  - The full-refresh path now calls `getTrendingFeedWithCursor` directly. That pulls the top N candidates without a skip scan, making scheduled refreshes cheaper and more predictable under large post counts.

- `backend/src/services/feed.service.ts`
  - New-feed prewarm uses cursor chaining to populate page 1 → page N sequentially. This avoids repeated `skip` queries and stops early when the cursor reports no more data, reducing unnecessary DB work.

- `backend/src/application/queries/feed/getTrendingFeed/getTrendingFeed.handler.ts`
  - The Redis-miss fallback now uses `getTrendingFeedWithFacet`, which returns data + total in a single aggregation. This reduces round-trips versus separate count queries while still delivering pagination metadata.

**Usage guidance**

- Use cursor methods for infinite scroll and deep pagination.
- Keep skip-based methods only where a strict `page/limit` UX is required and the depth is shallow.

### Request flow (edge to core)

```
Browser/Client
    |
    v
Nginx (frontend/nginx.conf)
    |  /api -> API Gateway
    |  /socket.io -> Backend (WebSocket)
    v
API Gateway (api-gateway/src/server.ts)
    |  CORS + rate limit + metrics
    |  /api/* -> backend:3000/*
    v
Backend (Express + CQRS)
    |  Controllers -> CommandBus/QueryBus
    |  Redis cache + MongoDB
    v
Response -> Gateway -> Nginx -> Client
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
    +--> Redis cache hit? -> return cached core feed
    |
    +--> cache miss -> PostRepository aggregation -> cache core feed
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
    +--> UnitOfWork (Mongo transaction)
    |      - persist post
    |      - queue domain events
    |
    v
EventBus (post-commit)
    |
    +--> Redis stream / sorted sets
    +--> workers update trending scores
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
