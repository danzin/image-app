# -- Build stage
FROM node:23.11.1-alpine AS builder
WORKDIR /app

# Copy root package files and the frontend workspace package.json so npm knows the workspace
COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/

# Install all dependencies (including dev) so tsc/vite have types & build tools
RUN npm ci --include=dev

# Copy the rest of the repo
COPY . .

# Optional: set build-time envs for Vite (pass via docker build --build-arg)
ARG VITE_API_URL
ARG VITE_SOCKET_URL
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_SOCKET_URL=${VITE_SOCKET_URL}

# Build the frontend using the frontend workspace's build script (runs in the workspace context)
RUN npm run build --workspace=frontend

# -- Serve stage
FROM nginx:alpine AS production
# Copy the built assets from the builder
COPY --from=builder /app/frontend/dist /usr/share/nginx/html

# Copy nginx config (if present)
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
