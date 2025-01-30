import 'reflect-metadata';
import dotenv from 'dotenv';
import { container } from 'tsyringe';
import { DatabaseConfig } from './config/dbConfig';
import { Server } from './server/server';
import { setupContainer } from './di/container';

async function bootstrap(): Promise<void> {
  try {
    // Setup dependency injection
    setupContainer();
    // Load .env  
    dotenv.config();
    
    
    // Get database instance and connect
    const dbConfig = container.resolve(DatabaseConfig);
    await dbConfig.connect();
    

    const port = Number(process.env.PORT) || 3000;
    const server = container.resolve<Server>(Server);
    server.start(port);
  } catch (error) {
    console.error('Startup failed', error);
    process.exit(1);
  }
}

bootstrap().catch(console.error);