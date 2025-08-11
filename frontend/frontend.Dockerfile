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

# Copy workspace config files
COPY frontend/tsconfig.json ./frontend/
COPY frontend/vite.config.ts ./frontend/
COPY frontend/tailwind.config.js ./frontend/
COPY frontend/postcss.config.js ./frontend/

# Copy frontend source code
COPY frontend/src ./frontend/src
COPY frontend/public ./frontend/public
COPY frontend/index.html ./frontend/

# Set build-time environment variables
ARG VITE_API_URL=http://localhost:8000
ENV VITE_API_URL=$VITE_API_URL

# Build frontend specifically
RUN npm run build --workspace=frontend

# -- Serve stage
FROM nginx:alpine
COPY --from=builder /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]