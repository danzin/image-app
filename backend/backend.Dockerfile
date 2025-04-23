# -- Build stage
FROM node:23.11.0-alpine AS builder

WORKDIR /src

# Copy package and tsconfig
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies including dev dependencies for build
RUN npm ci

# Copy source files
COPY . .

# Build TypeScript files
RUN npm run build

# -- Production stage
FROM node:23.11.0-alpine

WORKDIR /src

# Copy only production dependencies definition
COPY package*.json ./

# Install PRODUCTION dependencies first
RUN npm ci --omit=dev --ignore-scripts

# Copy built files from builder
COPY --from=builder /src/dist ./dist

# Use port 3000
EXPOSE 3000

# Start the backend
CMD ["node", "dist/main.js"]