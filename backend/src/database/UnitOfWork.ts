import { WithTransactionCallback } from 'mongodb';
import mongoose, { ClientSession } from 'mongoose';


export class UnitOfWork {
  private session: ClientSession | null = null;

  constructor() {
    if (!mongoose.connection.readyState) {
      throw new Error('Database connection not established');
    }
  }

  //Methods to be executed within a transaction are added as callbacks
  async executeInTransaction<T>(callback: WithTransactionCallback<T>): Promise<T> {
    const session = await mongoose.startSession();
    session.startTransaction();
  
    try {
      const result = await callback(session);
      await session.commitTransaction();
      return result;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
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
