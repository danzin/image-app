import { Request } from "express";
import { Server as HttpServer } from "http";
import { AuthFactory } from "../middleware/authentication.middleware";
import { Server as SocketIOServer } from "socket.io";
import { injectable } from "tsyringe";
import cookieParser from "cookie-parser";
import { createError } from "../utils/errors";

@injectable()
export class WebSocketServer {
	private io: SocketIOServer | null = null; // Stores the socket.io server instance

	/**
	 * Initializes the WebSocket server with authentication and event handling.
	 * @param {HttpServer} server - The HTTP server instance to attach the WebSocket server to.
	 */
	initialize(server: HttpServer): void {
		this.io = new SocketIOServer(server, {
			cors: {
				origin: (origin, callback) => {
					const allow = (process.env.ALLOWED_ORIGINS || "http://localhost:5173,http://localhost,http://localhost:80")
						.split(/[,\s]+/)
						.filter(Boolean);
					if (!origin || allow.includes(origin)) {
						return callback(null, true);
					}
					console.warn("[Socket CORS] Blocked origin", origin);
					callback(new Error("Not allowed by CORS"));
				},
				credentials: true, // Allows credentials (cookies etc...)
			},

			transports: ["websocket", "polling"],
		});

		/**
		 * Middleware to parse cookies from incoming socket requests.
		 * This allows authentication tokens stored in cookies to be accessed in socket requests.
		 */
		this.io.use((socket, next) => {
			cookieParser()(socket.request as any, {} as any, () => {
				next();
			});
		});

		/**
		 * Authentication middleware for WebSocket connections.
		 * Uses bearer token authentication from the incoming cookie to verify and attach user data to the socket.
		 */
		this.io.use(async (socket, next) => {
			try {
				const req = socket.request as Request;
				console.log("[Socket][Auth] Incoming handshake headers:", req.headers);
				console.log("[Socket][Auth] Incoming cookies:", (req as any).cookies);

				// Handle authentication using the bearer token strategy
				AuthFactory.bearerToken().handle()(req, {} as any, (error?: any) => {
					if (error) {
						console.error("Auth error:", error);
						return next(createError("AuthenticationError", error.message));
					}

					if (!req.decodedUser) {
						console.error("Missing decoded user after authentication");
						return next(createError("UnauthorizedError", "Unauthorized"));
					}
					console.log("[Socket][Auth] Authenticated user:", req.decodedUser);

					// Store user data in socket
					socket.data.user = req.decodedUser;
					next();
				});
			} catch (error) {
				console.error("WebSocket auth error:", error);
				next(createError("AuthenticationError", "Socket authentication failed"));
			}
		});

		/**
		 * Handles new client connections to the WebSocket server.
		 */
		this.io.on("connection", (socket) => {
			console.log("New client connected:", socket.id);

			// Join the user to their own private room

			const userPublicId = socket.data.user?.publicId || socket.data.user?.id;
			if (userPublicId) {
				socket.join(userPublicId);
				console.log(`User ${userPublicId} joined their room automatically`);

				// Send confirmation to client
				socket.emit("join_response", {
					success: true,
					userId: userPublicId,
					message: "Automatically joined user room",
				});
			} else {
				console.warn("Socket connected without user data:", socket.id);
			}

			/**
			 * Event listener for users manually joining a room.
			 * This ensures the user is authenticated before joining.
			 */
			socket.on("join", (userId: string) => {
				if (!socket.data.user) {
					console.warn("Unauthorized join attempt. Disconnecting socket.");
					return socket.disconnect(); // Disconnect unauthjorized users
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

	/**
	 * Retrieves the initialized Socket.IO instance.
	 * @returns {SocketIOServer} - The active WebSocket server instance.
	 * @throws {Error} - If the WebSocket server has not been initialized.
	 */
	getIO(): SocketIOServer {
		if (!this.io) {
			throw new Error("WebSocket server is not initialized.");
		}
		return this.io;
	}
}
