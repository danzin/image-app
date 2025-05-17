# -- Build stage
FROM node:23.11.0-alpine AS builder
WORKDIR /src

# Install all deps — invalidates only when package*.json change
COPY package*.json tsconfig.json ./
RUN npm ci

# Copy amd compile TS
COPY . .
RUN npm run build

# -- Production stage
FROM node:23.11.0-alpine
WORKDIR /src

# Install only prod deps (faster, smaller)
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts

# Copy compiled output
COPY --from=builder /src/dist ./dist

EXPOSE 3000
CMD ["node", "dist/main.js"]
