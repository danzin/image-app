# -- Build stage
FROM node:23.11.1-alpine AS builder
WORKDIR /src

COPY package*.json tsconfig.json ./
RUN npm ci --no-audit 

COPY . .
WORKDIR /src/src/api-gateway

RUN if [ -f package.json ]; then npm ci; fi

WORKDIR /src
RUN npm run build

# -- Production stage
FROM node:23.11.1-alpine
WORKDIR /src
# Install only prod deps (faster, smaller)
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts
# Copy compiled output
COPY --from=builder /src/dist ./dist
EXPOSE 3000
CMD ["node", "dist/main.js"]