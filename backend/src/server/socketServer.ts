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
      allowRequest: (req, callback) => {
        console.log('WebSocket Request Headers:', req.headers); 
        callback(null, true); 
      },
      transports: ["websocket", "polling"], 
    });
    
    this.io.engine.use(cookieParser());

    const authMiddleware = AuthFactory.bearerToken().handle();
    
    this.io.engine.use((req: any, res: any, next) => {

      authMiddleware(req, res, (error?: any) => {
        if (error) {
          console.error("Auth error:", error);
          return next(createError('AuthenticationError', error.message));
        }
        next();
      });
    });

    this.io.use(async (socket, next) => {
      try {

        const req = socket.request as Request;
        if (!req.decodedUser) {
          console.error("Unauthorized WebSocket connection attempt");
          return next(createError('UnauthorizedError', 'Unauthorized'));
        }

        socket.data.user = req.decodedUser;
        next();
      } catch (error) {
        console.error("WebSocket auth error:", error);
        next(createError('AuthenticationError', error.message));
      }
    });

    this.io.on("connection", (socket) => {
      console.log("New client connected:", socket.id);

      const userId = socket.data.user?.id;
      if (userId) {
        socket.join(userId);
        console.log(`User ${userId} joined their room`);
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
        console.log(`Socket rooms:`, socket.rooms);

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
