import mongoose from 'mongoose';
import { singleton } from 'tsyringe';

@singleton()
export class DatabaseConfig {
  private dbUri: string;

  constructor() {
    this.dbUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/myapp';
  }

  private setupGlobalPlugin(): void {
    mongoose.plugin((schema) => {
      schema.set('toJSON', {
        transform: (doc, ret) => {
          ret.id = ret._id.toString();
          delete ret._id;
          delete ret.__v;
          return ret;
        },
      });
    });
  }

  public async connect(): Promise<void> {
    try {
      this.setupGlobalPlugin();
      mongoose.set('debug', true);
      await mongoose.connect(this.dbUri);
      console.log('Database connected successfully');
    } catch (error) {
      console.error('Database connection failed', error);
      process.exit(1);
    }
  }
}
