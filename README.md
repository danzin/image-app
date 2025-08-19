# Image App

A full-stack React/Node image sharing application built with TypeScript, designed for scalability, performance, and maintainability. This project combines a clean, modular backend with a modern, responsive frontend.

Tech stack:

![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white) ![NodeJS](https://img.shields.io/badge/node.js-6DA55F?style=for-the-badge&logo=node.js&logoColor=white) ![MongoDB](https://img.shields.io/badge/MongoDB-%234ea94b.svg?style=for-the-badge&logo=mongodb&logoColor=white) ![Socket.io](https://img.shields.io/badge/Socket.io-black?style=for-the-badge&logo=socket.io&badgeColor=010101) ![Redis](https://img.shields.io/badge/redis-%23DD0031.svg?style=for-the-badge&logo=redis&logoColor=white) ![Express.js](https://img.shields.io/badge/express.js-%23404d59.svg?style=for-the-badge&logo=express&logoColor=%2361DAFB) ![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)  ![TailwindCSS](https://img.shields.io/badge/tailwindcss-%2338B2AC.svg?style=for-the-badge&logo=tailwind-css&logoColor=white) ![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?style=for-the-badge&logo=docker&logoColor=white)

## Table of Contents
- [Overview](#overview)
- [Features](#features)
- [API Endpoints](#api-endpoints)
- [Architecture & Implementation](#architecture--implementation)
- [Future Improvements](#future-improvements)
- [Installation & Setup](#installation--setup)

## Overview
**Image App** offers users a seamless experience for uploading, sharing, and discovering images. With a robust React frontend and a Node.js backend leveraging TypeScript, this project embodies a clean, modular architecture built for modern web applications. 
 * **In transition to CQRS, parts of the system are already using utilizing the CQRS pattern**

## Features

- **Dockerization**
   - The docker setup includes multiple services and a few extra caveats in order to run hassle-free
      - *Mongo-setup service* - A helper service handling the keyfile for the single-node replica set auth
      - *MongoDB service* - Mongo database running as a single-node replica set with persistent storage volume
      - *Redis service* - Caching solution with persistent storage volume 
      - *Backend service* - The whole backend of the app(decoupling into microservices is in progress)
      - *Api-Gateway service* - An extra layer providing CORS enforcement, rate limiting(very lax as of now), reverse proxy and global request logging.
      - *Frontend service* - The react frontend of the app. It utilizes Nginx together with the Api-Gateway.
    - Routing Architecture:
![image](https://github.com/user-attachments/assets/be1da114-3c9e-4eb1-b5d6-433338267a9b)

        
- **CQRS**: **Currently working on gradually switching from the classic modular architecture to CQRS.**
  - Command, Query and Event buses are implemented and fully functional.
  - The Event bus supports transactions. `queueTransactional`, `flushTransactionalQueue` and `clearTransactionalQueue` make it easy to integrate within the UnitOfWork pattern and other operations utilizing transactions. 
  - Some methods from the service layer are already obsolete and replaced by their corresponding commands and queries.
  - In order to have a gradual and seamless shift in architectures, and to make sure nothing breaks, the old functionality remains registered inside the Dependency Injection container, alongside the most recent Commands, Queries and Buses.
    
- **API Gateway:** **Serves as a dedicated layer within the internal network focused solely on managing API traffic before it hits the final backend service**
  - **Rate Limiting:**  Applies rate limiting (express-rate-limit). This logic lives within the gateway service. This ensures requests are limited before they even reach the core backend logic.
  - **Centralized Logging (API Focus):** It provides specific logging points (onProxyReq, onProxyRes, onError) focused on the API request lifecycle as it passes between the frontend proxy and the backend service.
  - **Decoupling & Routing Hub (Future Microservices):** Crucially, this gateway is perfectly positioned for when I break down the monolith (backend service) into microservices.
    
- **Modular Backend Architecture:**
  - **Domain Models:** Models for images, tags, users, userActions, userPreferences, follows, and likes.
  - **Repositories:** A base repository abstract class extended by model-specific repositories.
  - **Service Layer & Controllers:** Clean separation of business logic from API request handling.
  - **Routers** use authentication middleware implementing the Strategy pattern, extracting JWT from cookies and attaching a decodedUser object into Express' Request interface for controllers to work with. 
  - **Dependency Injection:** Using TSyringe for DI, ensuring loose coupling and testability.
  - **Custom Error Handling:** Implemented via a factory pattern for consistent error responses.
  - **Data Transfer Objects (DTOs):** Tailored data views for guests, authenticated users, and admins.
    
- **Real-Time Functionality:**
  - **WebSockets with Socket.io:** Secure, token-based WebSocket server for instant notifications.
  - **Personalized Feeds:** Logged in users are served custom feed according to their interactions with images and other users.
  - **Redis caching:** User feed is cached for a set period of time and served from Redis rather than querying the Database every time, enhancing performance and reducing server load. Cache is invalidated when changes occur on the feed(user uploads or removes an image, etc) 
    
- **Modern Frontend:**
  - Developed with React and TypeScript for a responsive and maintainable UI with MUI and TailwindCSS.
  - ReactQuery and Routes for optimal performance and state management.
  - Cookie-based authentication using JWT. 
  - E2E testing with Cypress
    
- **Transaction Management:**
  - Uses database transactions and the Unit of Work pattern to ensure data integrity with complex operations.
    
- **Docker:**
  - You can run the app in docker using `docker-compose up --build` It defaults to using local storage in /backend/uploads for images if Cloudinary credentials are not set. When running in Docker it also uses [nginx](https://nginx.org/en/). 
    
- **Planned Enhancements:**
  - **Redis:** Expanding Redis coverage for the app. 
  - **Further frontend polishing:** Backend has been my primary focus so far. The frontend UI, performance and E2E coverege will be enhanced in later commits.
  - **Decoupling:** Planning on decoupling functionality from the monolith into microservices

## API Endpoints

### Users
- **GET** `/api/users/:userId` - Retrieve user information by ID.
- **GET** `/api/users/users` - Retrieve a list of users.
- **GET** `/api/users/me` - Get the profile of the logged-in user. (requires authentication).
- **GET** `/api/users/follows/:followeeId` - Check if a follow relationship exists. (requires authentication).
- **POST** `/api/users/register` - Register a new user.
- **POST** `/api/users/login` - Authenticate a user. 
- **POST** `/api/users/logout` - Log out the current user. 
- **POST** `/api/users/follow/:followeeId` - Follow another user(if the follower already follows the followee, they unfollow them). (requires authentication).
- **POST** `/api/users/like/:imageId` - Like an image(if the image is already liked, the user un-likes it). (requires authentication).
- **PUT** `/api/users/edit` - Update user profile information. (requires authentication).
- **PUT** `/api/users/avatar` - Update user avatar. (requires authentication).
- **PUT** `/api/users/cover` - Update user cover photo. (requires authentication).
- **DELETE** `/api/users/:id` - Delete a user. (requires authentication).

### Images
- **GET** `/api/images/` - Retrieve all images.
- **GET** `/api/images/user/:id` - Get images uploaded by a specific user.
- **GET** `/api/images/search/tags` - Search images by tags.
- **GET** `/api/images/:id` - Retrieve image by ID.
- **GET** `/api/images/tags` - Retrieve all available tags.
- **POST** `/api/images/upload` - Upload a new image (requires authentication).
- **DELETE** `/api/images/:id` - Delete an image (requires authentication).

### Search
- **GET** `/api/search/` - Perform a universal search across users, images, and tags.

### Admin
- **API paths under `/api/admin`** - Administrative actions and management tasks.

### Notifications
- **API paths under `/api/notifications`** - Managing real-time notifications. (requires authentication).

### Feed
- **GET** `/api/feed/` - Retrieve a personalized feed for the logged-in user. (requires authentication, guest users get a generic feed sorted by recency).


## Architecture & Implementation
The project is built on solid architectural principles:
- **Object-Oriented Design:**  
  The backend is divided into models, repositories, services, and controllers, ensuring a clean separation of concerns.
- **Dependency Injection:**  
  TSyringe is used to inject dependencies, promoting modularity and easier testing.
- **Custom Error Handling & DTOs:**  
  Consistent error responses are achieved with custom error handlers, and DTOs tailor the data output based on user roles.
- **Transaction Management:**  
  Database transactions and the Unit of Work pattern maintain data integrity.
- **Search Functionality:**  
  A universal search mechanism efficiently searches across users, images, and tags.
- **Couldinary integration:**
  - Uploaded images are stored on Cloudinary, only relevant metadata is stored in MongoDB.
- **Local Storage integration:**
  - If Cloudinary is not set up, images are stored locally in /backend/uploads. 
- **Real-Time Communication:**  
  The WebSocket server uses advanced, token-based authentication with custom authentication middleware to secure connections. Clients join specific rooms (e.g., by user ID) to receive personalized notifications instantly.
  
## Future Improvements
 - **Redis Caching:**
    Planned integration - cache frequently accessed data, greatly enhancing performance and scalability.
      - User feed - Done ✅
 - **Enhanced Security Features:**
    Continued enhancements to authentication, authorization, and data protection.
      - Done ✅ 
 - **Expanded Search Capabilities:**
    Refining the universal search to support advanced queries and more refined result filtering.
      - Done ✅
 - **Additional API Endpoints:** 
    Further expansion of administrative, notification, and real-time features.
 - **Polishing the frontend**:
    So far the backend has been my primary focus and frontend has been falling behind.
      - Done ✅
 - **Full monitoring suite**
   
## Installation & Setup

### Prerequisites
- Node.js (v22.12.0+ recommended)
- npm
- Local Redis instance 
- Local MongoDB instance OR MongoDB Atlas connection string
- Example .env file: 
    ```
    //MongoDB Atlas connection string. If not provided, the app is looking for local mongodb connection at mongodb://127.0.0.1:27017
    MONGODB_URI=mongodb+srv://mongodbusername:dbpassword@cluster/databasename?more&options
    
    //JWT Secret
    JWT_SECRET=xxxxxxxxxxxxxxxx
    
    //Cloudinary credentials, not required. The app defaults to local storage if Cloudinary is unavailable.
    CLOUDINARY_CLOUD_NAME=xxxxxxxxxxxxx 
    CLOUDINARY_API_KEY=xxxxxxxxxxxxx
    CLOUDINARY_API_SECRET=xxxxxxxxxxxxx
    
    //Default port
    PORT=3000
    
    //Backend port used in docker-compose.yml
    BACKEND_PORT=3000
    FRONTEND_URL=http://localhost:5173
    
    //Node environment, is overriden in docker-compose.yml
    NODE_ENV=development
    
    VITE_API_URL=http://localhost:3000
    ```

### Running the app in Docker 
1. Make sure you have [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/) installed on your machine.
2. 
    ```
   git clone https://github.com/danzin/image-app.git
   cd image-app
   docker-compose up --build
   ```
    
  
### Dev Setup
1. **Clone the repository and install dependencies in the root directory:**
```
   git clone https://github.com/danzin/image-app.git
   cd image-app
```
2. **`npm install` installs all the dependencies for all workspaces from the monorepo**
   - It requires an active redis server running on the default `6379` port, as well as a configured local mongodb instance
3. **`npm run dev`** starts the local dev environment. 
   
