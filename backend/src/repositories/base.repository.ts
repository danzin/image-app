import mongoose, { ClientSession, FilterQuery, ModifyResult, UpdateQuery } from "mongoose";
import { IRepository } from "../types";
import { createError } from "../utils/errors";

/**
 * BaseRepository provides generic CRUD operations for MongoDB models.
 * It serves as the foundation for all other repositories.
 */
export abstract class BaseRepository<T extends mongoose.Document> implements IRepository<T> {
  constructor(protected readonly model: mongoose.Model<T>) {}

   /**
   * Creates a new document in the database.
   * @param item - The data to create.
   * @param session - (Optional) Mongoose session for transactions.
   * @returns The created document.
   */
  async create(item: Partial<T>, session?: ClientSession): Promise<T> {
    try {
      const doc = new this.model(item);
      if (session) doc.$session(session); 
      return await doc.save(); 
    } catch (error) {
      throw createError('UoWError', error.message);
    }
  }

   /**
   * Updates a document by ID.
   * @param id - The document ID to update.
   * @param item - The update operations.
   * @param session - (Optional) Mongoose session for transactions.
   * @returns The updated document or null if not found.
   */
  async update(id: string, item: Partial<T>, session?: ClientSession): Promise<T | null> {
    try {
      const query = this.model.findByIdAndUpdate(id, { $set: item }, { new: true });
      if (session) query.session(session); 
      return await query.exec();
    } catch (error) {

      throw createError('UoWError', error.message);
    }
  }

   /**
   * Deletes a document by ID.
   * @param id - The document ID to delete.
   * @param session - (Optional) Mongoose session for transactions.
   * @returns True if deleted, false otherwise.
   */
  async delete(id: string, session?: ClientSession): Promise<boolean> {
    try {
      const query = this.model.findOneAndDelete({_id: id});
      if (session) query.session(session); 
      const result = await query.exec();
      console.log(`result from execution of delete in imageRepository: ${result}`)
      return result !== null;
    } catch (error) {
      throw createError('UoWError', error.message)
    }
  }

  /**
   * Finds a document by ID.
   * @param id - The document ID to search for.
   * @param session - (Optional) Mongoose session for transactions.
   * @returns The document or null if not found.
   */
  async findById(id: string, session?: ClientSession): Promise<T | null> {
    try {
      const query = this.model.findById({_id: id});
      if (session) query.session(session);
      return await query.exec();
    } catch (error) {
      throw createError('UoWError', error.message);
    }
  }

  // Extend the Base repository with this method as I'll need it in 
  // multiple repositories. 
  // Adjust return type to include ModifyResult<T> because it's what findOneAndUpdate returns. 
  // Adjust update to be of type UpdateQuery<T> as it includes all MongoDB specific operators
  // Using .lean() instead of adjusting the return type is out of the question as it causes horrors beyond my comprehension further down the line.
  // 
  async findOneAndUpdate(filter: FilterQuery<T>, update: UpdateQuery<T>, session?: ClientSession): Promise<T | ModifyResult<T> | null> {
    try {
      const query = this.model.findOneAndUpdate(filter, update, { new: true }); // Removed the { update } wrapping
      if (session) query.session(session);
      return await query.exec();
    } catch (error) {
      throw createError('UoWError', error.message);
    }
  }

  
}
