
//enables the usage of decorators and metadata reflection in TypeScript
import 'reflect-metadata';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { container } from 'tsyringe';
import { DatabaseConfig } from './config/dbConfig';
import { Server } from './server/server';
import { setupContainer } from './di/container';
import { WebSocketServer } from './server/socketServer';

async function bootstrap(): Promise<void> {
  try {
    // Load environment variables first
    dotenv.config();
    
    // Setup dependency injection
    setupContainer();
    
    // Connect to database
    const dbConfig = container.resolve(DatabaseConfig);
    await dbConfig.connect();
    
    // Create Express app and HTTP server
    const expressServer = container.resolve(Server);
    const app = expressServer.getExpressApp();
    const server = createServer(app);
    
    // Initialize WebSocket server
    const webSocketServer = container.resolve<WebSocketServer>('WebSocketServer');
    webSocketServer.initialize(server);
    
    // Start the HTTP server last
    const port = Number(process.env.PORT) || 3000;
    expressServer.start(server, port);
  } catch (error) {
    console.error('Startup failed', error);
    process.exit(1);
  }
}

bootstrap().catch(console.error);
