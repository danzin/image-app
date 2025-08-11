# -- Build stage
FROM node:23.11.1-alpine AS builder
WORKDIR /app

# Copy root package files (for workspace setup)
COPY package*.json tsconfig.json ./

# Copy workspace package files
COPY backend/package*.json ./backend/
COPY api-gateway/package*.json ./api-gateway/
COPY frontend/package*.json ./frontend/

# Install all dependencies
RUN npm ci --no-audit

# Copy workspace tsconfig files
COPY backend/tsconfig.json ./backend/
COPY api-gateway/tsconfig.json ./api-gateway/

# Copy source code
COPY api-gateway/src ./api-gateway/src

# Build api-gateway specifically  
RUN npm run build --workspace=api-gateway

# -- Production stage
FROM node:23.11.1-alpine
WORKDIR /app

# Copy root package files
COPY package*.json ./
COPY api-gateway/package*.json ./api-gateway/

# Install only production dependencies
RUN npm ci --omit=dev --ignore-scripts

# Copy compiled api-gateway output
COPY --from=builder /app/api-gateway/dist ./api-gateway/dist

# Set working directory to api-gateway for runtime
WORKDIR /app/api-gateway

ENV PORT=8000
EXPOSE 8000
CMD ["node", "dist/server.js"]