# -- Build stage
FROM node:23.11.0-alpine AS builder
WORKDIR /app

# Copy root package files and each workspace package.json so npm knows the workspaces
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/
COPY api-gateway/package.json ./api-gateway/
COPY frontend/package.json ./frontend/

# Install ALL dependencies including dev deps (needed for tsc)
RUN npm ci --include=dev


# Copy rest of the sources
COPY api-gateway/src ./api-gateway/src
COPY api-gateway/tsconfig.json ./api-gateway/
COPY tsconfig.base.json ./

# Build the specific workspace
RUN npm run build --workspace=api-gateway
# -- Production stage
FROM node:23.11.0-alpine
WORKDIR /app

# Copy the root package files again
COPY package.json package-lock.json ./

# Copy the package.json files for each workspace so npm knows what to install
COPY backend/package.json ./backend/
COPY api-gateway/package.json ./api-gateway/
COPY frontend/package.json ./frontend/

# Install ONLY production dependencies for all workspaces
RUN npm ci --omit=dev

# Create a non-root user 
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy compiled code with ownership
COPY --from=builder --chown=nodejs:nodejs /app/api-gateway/dist ./api-gateway/dist

# Switch to non-root user
USER nodejs

# The gateway listens on 8000 externally; expose same internally for clarity
EXPOSE 8000

# Use the built server.js (compiled from src/server.ts)
CMD ["node", "api-gateway/dist/server.js"]