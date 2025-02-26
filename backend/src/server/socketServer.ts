import { Request } from "express";
import { Server as HttpServer } from "http";
import { AuthFactory } from "../middleware/authentication.middleware";
import { Server as SocketIOServer } from "socket.io";
import { injectable } from "tsyringe";
import cookieParser from "cookie-parser";
import { createError } from "../utils/errors";

@injectable()
export class WebSocketServer {
  private io: SocketIOServer | null = null;

  initialize(server: HttpServer): void {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: "http://localhost:5173",
        credentials: true,
      },

      transports: ["websocket", "polling"],
    });
   
    // Apply cookie parser to the socket handshake
    this.io.use((socket, next) => {
      cookieParser()(socket.request as any, {} as any, () => {
        next();
      });
    });

    // Auth middleware for socket
    this.io.use(async (socket, next) => {
      try {
        const req = socket.request as Request;
        AuthFactory.bearerToken().handle()(req, {} as any, (error?: any) => {
          if (error) {
            console.error("Auth error:", error);
            return next(createError('AuthenticationError', error.message));
          }
          
          if (!req.decodedUser) {
            console.error("Missing decoded user after authentication");
            return next(createError('UnauthorizedError', 'Unauthorized'));
          }
          
          // Store user data in socket
          socket.data.user = req.decodedUser;
          next();
        });
      } catch (error) {
        console.error("WebSocket auth error:", error);
        next(createError('AuthenticationError', 'Socket authentication failed'));
      }
    });

    this.io.on("connection", (socket) => {
      console.log("New client connected:", socket.id);
      
      const userId = socket.data.user?.id;
      if (userId) {
        socket.join(userId);
        console.log(`User ${userId} joined their room automatically`);
        
        // Send confirmation to client
        socket.emit("join_response", {
          success: true,
          userId: userId,
          message: "Automatically joined user room"
        });
      } else {
        console.warn("Socket connected without user data:", socket.id);
      }

      socket.on("join", (userId: string) => {
        if (!socket.data.user) {
          console.warn("Unauthorized join attempt. Disconnecting socket.");
          return socket.disconnect();
        }
        
        const trimmedUserId = userId.trim();
        console.log(`Received a join event with data: ${trimmedUserId}`);
        socket.join(trimmedUserId);
        console.log(`User ${trimmedUserId} joined their room`);
        console.log(`Socket rooms:`, Array.from(socket.rooms));
        
        // Emit success message
        socket.emit("join_response", {
          success: true,
          userId: trimmedUserId,
        });
      });

      socket.on("disconnect", () => {
        console.log("Client disconnected:", socket.id);
      });
    });
    
    console.log("WebSocket server initialized.");
  }

  getIO(): SocketIOServer {
    if (!this.io) {
      throw new Error("WebSocket server is not initialized.");
    }
    return this.io;
  }
}