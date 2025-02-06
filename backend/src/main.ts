
//enables the usage of decorators and metadata reflection in TypeScript
import 'reflect-metadata';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();
// Register global mongoose plugin before individual models
mongoose.plugin((schema) => {
  schema.set('toJSON', {
    transform: (doc, ret) => {
      // console.log('Global plugin transforming document:', ret);
      ret.id = ret._id.toString();
      delete ret._id;
      delete ret.__v;
      return ret;
    },
  });
});

import { createServer } from 'http';
import { container } from 'tsyringe';
import { DatabaseConfig } from './config/dbConfig';
import { Server } from './server/server';
import { setupContainer } from './di/container';
import { WebSocketServer } from './server/socketServer';

async function bootstrap(): Promise<void> {
  try {
    // Connect to database
    const dbConfig = container.resolve(DatabaseConfig);
    await dbConfig.connect();
    
    // Setup dependency injection
    setupContainer(); 
    
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
