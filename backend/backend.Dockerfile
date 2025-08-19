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
COPY . .

# Build the specific workspace
RUN npm run build --workspace=backend

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

# Copy ONLY the compiled backend code from the builder stage
COPY --from=builder /app/backend/dist ./backend/dist

EXPOSE 3000

# The command must now point to the correct path within the container
CMD ["node", "backend/dist/main.js"]