FROM node:23.11.0-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy frontend source files
COPY . .

# Build the frontend
RUN npm run build

# Use Nginx
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

# Start frontend with nginx
CMD ["nginx", "-g", "daemon off;"]
