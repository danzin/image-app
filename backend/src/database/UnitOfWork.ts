import { EventBus } from '../application/common/buses/event.bus';
import { WithTransactionCallback } from 'mongodb';
import mongoose, { ClientSession } from 'mongoose';
import { inject, injectable } from 'tsyringe';

@injectable()
export class UnitOfWork {
  private session: ClientSession | null = null;

  constructor(@inject('EventBus') private readonly eventBus: EventBus) {
    if (!mongoose.connection.readyState) {
      throw new Error('Database connection not established');
    }
  }

  async executeInTransaction<T>(work: (session: ClientSession) => Promise<T>): Promise<T> 
  {
    const session = await mongoose.startSession();
    session.startTransaction();
  
    try {
      const result = await work(session);
      await session.commitTransaction();
      
      // Flush events affter successful commit 
      await this.eventBus.flushTransactionalQueue();

      return result;
    } catch (error) {
      await session.abortTransaction();
      
      // Clear failed events
      this.eventBus.clearTransactionalQueue(); 
      throw error;
    } finally {
      session.endSession();
    }
  }
  
  getSession(): ClientSession | null {
    return this.session;
  }
}
