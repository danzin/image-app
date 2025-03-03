import mongoose from 'mongoose';
import { singleton } from 'tsyringe';

@singleton()
export class DatabaseConfig {
  private dbUri: string;

  constructor() {
    this.dbUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/image-app';
  }

  public async connect(): Promise<void> {
    try {

      // mongoose.set('debug', true);
      await mongoose.connect(this.dbUri);
      console.log('Database connected successfully');
    } catch (error) {
      console.error('Database connection failed', error);
      process.exit(1);
    }
  }
}
