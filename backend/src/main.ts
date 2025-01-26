import { DatabaseConfig } from './config/dbConfig';
import { Server } from './server/server';

async function bootstrap(): Promise<void> {
  try {
    const port = Number(process.env.PORT);
    const dbConfig = new DatabaseConfig();
    await dbConfig.connect();
    
    const server = new Server(port);
    server.start();
  } catch (error) {
    console.error('Startup failed', error);
    process.exit(1);
  }
}

bootstrap();

