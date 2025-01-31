import { Server as HttpServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { injectable } from "tsyringe";

@injectable()
export class WebSocketServer {
  private io: SocketIOServer | null = null;

  initialize(server: HttpServer): void {
    this.io = new SocketIOServer(server, {
      cors: { origin: "*" },
    });

    this.io.on("connection", (socket) => {
      console.log("New client connected:", socket.id);

      socket.on("join", (userId: string) => {
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