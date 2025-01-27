import { DatabaseConfig } from './config/dbConfig';
import  {Server}  from './server/server';
import dotenv from 'dotenv';

async function bootstrap(): Promise<void> {
  try {
    // Load environment variables first
    dotenv.config();
    
    // Database connection
    const dbConfig = new DatabaseConfig();
    await dbConfig.connect();

    // Server initialization
    const port = Number(process.env.PORT) || 3000;
    const server = new Server();
    server.start(port);
  } catch (error) {
    console.error('Startup failed', error);
    process.exit(1);
  }
}

bootstrap();