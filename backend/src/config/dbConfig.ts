import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

export class DatabaseConfig{
  private dbUri: string;

  constructor(){
    this.dbUri = process.env.MONGODB_URI;
  }

  public async connect(): Promise<void>{
    try {
      await mongoose.connect(this.dbUri);
      console.log('Database connected successfully');
    } catch (error) {
      console.error('Database connection failed', error);
      process.exit(1);
    }
  }

  
}
