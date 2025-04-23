  # -- Build stage
  FROM node:23.11.0-alpine AS builder

  WORKDIR /src
  
  COPY package*.json ./
  COPY tsconfig.json ./
  
  # Install all dependencies 
  RUN npm ci
  
  # Copy the rest of the gateway source code
  COPY . .
  
  # Build TypeScript
  RUN npm run build
  
  # -- Production Stage 
  FROM node:23.11.0-alpine


  WORKDIR /src
  
  COPY package*.json ./
  
  RUN npm ci --omit=dev
  
  # Copy compiled code from builder stage
  COPY --from=builder /src/dist ./dist
  
  # Define the internal port the gateway will listen on
  ENV PORT=8000
  EXPOSE 8000
  
  # Start the gateway
  CMD [ "node", "dist/server.js" ]