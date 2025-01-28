import { WithTransactionCallback } from 'mongodb';
import mongoose, { ClientSession } from 'mongoose';
import { createError } from '../utils/errors';

// Define types for operations
type Operation = (session: ClientSession) => Promise<void>;

export class UnitOfWork {
  private session: ClientSession | null = null;
  private operations: Operation[] = [];

  constructor() {
    if (!mongoose.connection.readyState) {
      throw new Error('Database connection not established');
    }
  }

  
  async executeInTransaction<T>(callback: WithTransactionCallback<T>): Promise<T> {
    this.session = await mongoose.startSession();
    this.session.startTransaction();
    
    try {
      const result = await callback(this.session);
      await this.session.commitTransaction();
      return result;
    } catch (error) {
      if (this.session) {
        await this.session.abortTransaction();
      }
      throw error;
    } finally {
      if (this.session) {
        await this.session.endSession();
        this.session = null;
      }
    }
  }
  
  
  /**Might need the registerOperation and commit pattern for future use. */
  // registerOperation(operation: Operation): void {
  //   this.operations.push(operation);
  // }

  // async commit(): Promise<void> {
  //   try {
  //     this.session = await mongoose.startSession();
  //     this.session.startTransaction();

  //     // Execute all registered operations
  //     for (const operation of this.operations) {
  //       await operation(this.session);
  //     }

  //     // Commit the transaction
  //     await this.session.commitTransaction();
  //   } catch (error) {
  //     // If any operation fails, roll back the transaction
  //     if (this.session) {
  //       await this.session.abortTransaction();
  //     }
  //     throw error;
  //   } finally {
  //     // Clean up
  //     if (this.session) {
  //       await this.session.endSession();
  //       this.session = null;
  //     }
  //     this.operations = [];
  //   }
  // }

  // Get the current session
  getSession(): ClientSession | null {
    return this.session;
  }
}



//TODO: Move in with the rest of the types
// Interface for repositories that will use UnitOfWork
export interface IRepository<T> {
  create(item: Partial<T>, session?: ClientSession): Promise<T>;
  update(id: string, item: Partial<T>, session?: ClientSession): Promise<T | null>;
  delete(id: string, session?: ClientSession): Promise<boolean>;
  findById(id: string, session?: ClientSession): Promise<T | null>;
}



// Base repository implementation
export abstract class BaseRepository<T> implements IRepository<T> {
  constructor(protected readonly model: mongoose.Model<T>) {}

  async create(item: Partial<T>, session?: ClientSession): Promise<T> {
    try {
      console.log('Creating item:', item);
      return await this.model.create([item], { session }).then(docs => docs[0]);
      
    } catch (error) {
      createError('UoWError', error.message)

    }
  }

  async update(id: string, item: Partial<T>, session?: ClientSession): Promise<T | null> {
    try {
      return await this.model.findByIdAndUpdate(id, item, { new: true, session });
      
    } catch (error) {
      createError('UoWError', error.message)
    }
  }

  async delete(id: string, session?: ClientSession): Promise<boolean> {
    try {
      const result = await this.model.findByIdAndDelete(id, { session });
      return result !== null;
      
    } catch (error) {
      createError('UoWError', error.message)

    }
  }

  async findById(id: string, session?: ClientSession): Promise<T | null> {
    try {
      return await this.model.findById(id).session(session);
      
    } catch (error) {
      createError('UoWError', error.message)

    }
  }
}