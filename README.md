# Image Sharing App

A full-stack React/Node image sharing application built with TypeScript, designed for scalability, performance, and maintainability. This project combines a clean, modular backend with a modern, responsive frontend—making it an outstanding solution for dynamic image sharing.

## Table of Contents
- [Overview](#overview)
- [Features](#features)
- [API Endpoints](#api-endpoints)
- [Architecture & Implementation](#architecture--implementation)
- [Future Improvements](#future-improvements)
- [Installation & Setup](#installation--setup)

## Overview
**Image Sharing App** offers users a seamless experience for uploading, sharing, and discovering images. With a robust React frontend and a Node.js backend leveraging TypeScript, this project embodies a clean, modular architecture built for modern web applications.

## Features
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
  - **Personalized Feeds:** Customized content feeds based on user interactions.
- **Modern Frontend:**
  - Developed with React and TypeScript for a responsive and maintainable UI with MUI and TailwindCSS.
  - ReactQuery and Routes for optimal performance and state management.
  - Cookie-based authentication using JWT. 
  - E2E testing with Cypress
- **Transaction Management:**
  - Uses database transactions and the Unit of Work pattern to ensure data integrity with complex operations.
- **Planned Enhancements:**
  - **Redis Caching:** Future integration to boost performance and scalability.
  - **Further frontend polishing:** Backend has been my primary focus so far. The frontend UI, performance and E2E coverege will be enhanced in later commits.

## API Endpoints

### Users
- **POST** `/api/users/register` - Register a new user.
- **POST** `/api/users/login` - Authenticate a user and start a session.
- **POST** `/api/users/logout` - Log out the current user.
- **GET** `/api/users/users` - Retrieve a list of users.
- **GET** `/api/users/me` - Get the profile of the logged-in user.
- **PUT** `/api/users/edit` - Update user profile information.
- **POST** `/api/users/follow/:followeeId` - Follow another user.
- **GET** `/api/users/follows/:followeeId` - Check if a follow relationship exists.
- **POST** `/api/users/like/:imageId` - Like an image.
- **PUT** `/api/users/avatar` - Update user avatar.
- **PUT** `/api/users/cover` - Update user cover photo.
- **DELETE** `/api/users/:id` - Delete a user.
- **GET** `/api/users/:userId` - Retrieve user information by ID.

### Images
- **GET** `/api/images/` - Retrieve all images.
- **GET** `/api/images/user/:id` - Get images uploaded by a specific user.
- **GET** `/api/images/search/tags` - Search images by tags.
- **GET** `/api/images/tags` - Retrieve all available tags.
- **POST** `/api/images/upload` - Upload a new image (requires authentication).
- **DELETE** `/api/images/:id` - Delete an image (requires authentication).
- **GET** `/api/images/:id` - Retrieve image details by ID.

### Search
- **GET** `/api/search/` - Perform a universal search across users, images, and tags.

### Admin
- **API paths under `/api/admin`** - Administrative actions and management tasks.

### Notifications
- **API paths under `/api/notifications`** - Managing real-time notifications.

### Feed
- **GET** `/api/feed/` - Retrieve a personalized feed for the logged-in user.

### WebSockets
- **Real-Time Communication:**  
  The WebSocket server uses advanced, token-based authentication with custom authentication middleware to secure connections. Clients join specific rooms (e.g., by user ID) to receive personalized notifications instantly.

## Architecture & Implementation
The project is built on solid architectural principles:
- **Object-Oriented Design:**  
  The backend is divided into models, repositories, services, and controllers, ensuring a clean separation of concerns.
- **Dependency Injection:**  
  TSyringe is used to inject dependencies, promoting modularity and easier testing.
- **Custom Error Handling & DTOs:**  
  Consistent error responses are achieved with custom error handlers, and DTOs tailor the data output based on user roles.
- **Real-Time Communication:**  
  Secure WebSocket connections (using Socket.io) provide instant notifications.
- **Transaction Management:**  
  Database transactions and the Unit of Work pattern maintain data integrity.
- **Search Functionality:**  
  A universal search mechanism efficiently searches across users, images, and tags.
- **Couldinary integration:**
  Uploaded images are stored on Cloudinary, only relevant metadata is stored in MongoDB.
  
## Future Improvements
 - **Redis Caching:**
   Planned integration to cache frequently accessed data, greatly enhancing performance and scalability.
 - **Enhanced Security Features:**
    Continued enhancements to authentication, authorization, and data protection.
 - **Expanded Search Capabilities:**
    Refining the universal search to support advanced queries and more refined result filtering.
 - **Additional API Endpoints:** 
    Further expansion of administrative, notification, and real-time features.
 - **Dockerization**
 - **Polishing the frontend**, as so far the backend has been my primary focus.
 - **Full monitoring suite**
   
## Installation & Setup

### Prerequisites
- Node.js (v22.12.0+ recommended)
- npm
- A local or remote MongoDB instance
- Cloudinary account
  
### Setup
1. **Clone the repository and intall dependencies in the root directory:**
   ```
   git clone https://github.com/danzin/image-app.git
   cd image-app
   npm install
   ```
#### Backend   
2. **Navigate to the backend directory and install dependencies:**
    ```
    cd backend
    npm install
      ```
3. **Configure Environment Variables:**
  Create a `.env` file with your Mongodb URI, JWT Secret, Cloudinary Cloud Name, Cloudinary API Key, Cloudinary API Secret, and PORT where the backend will run on

#### Frontend 
4. **Navigate to the frontend directory and install dependencies:**
  ```
  cd frontend
  npm install
  ```
5. To run the app navigate to the root directory in `image-app` and run `npm run dev`.
  `npm run dev` executes `"dev": "concurrently \"npm run start-backend\" \"npm run start-frontend\" "` from the `package.json` file.
   
 
   
