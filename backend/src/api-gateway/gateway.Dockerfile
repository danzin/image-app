FROM node:23.11.1-alpine AS builder
WORKDIR /src
# Install all deps
COPY package*.json tsconfig.json ./
RUN npm ci --no-audit

# Copy gateway source & compile
COPY . .
RUN npm run build

# -- Production stage
FROM node:23.11.0-alpine
WORKDIR /src

# Install only prod deps
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts

# Copy compiled output
COPY --from=builder /src/dist ./dist
ENV PORT=8000
EXPOSE 8000
CMD ["node", "dist/server.js"]