import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

export class DatabaseConfig{
  private dbUri: string;

  constructor(){
    this.dbUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/myapp';
  }

  private setupGlobalPlugin(): void {
    // Define the global plugin
    mongoose.plugin((schema) => {
      schema.set('toJSON', {
        transform: (doc, ret) => {
          //convert _id to string and replace it with id
          //remove _id and __v 
          ret.id = ret._id.toString(); 
          delete ret._id;             
          delete ret.__v;             
          return ret;
        },
      });
    });
  }


  public async connect(): Promise<void>{
    try {
      this.setupGlobalPlugin();
      mongoose.set('debug', true);  //enable debug mode because omg 
      await mongoose.connect(this.dbUri);
      console.log('Database connected successfully');
    } catch (error) {
      console.error('Database connection failed', error);
      process.exit(1);
    }
  }

  
}
