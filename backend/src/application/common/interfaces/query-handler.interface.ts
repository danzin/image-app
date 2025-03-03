import { IQuery } from "./query.interface";

/** TQuery is a generic type extending IQuery. It can be any type that implements the IQuery interface. 
 *  TResult is a generic type and it must always be provided when implementing the interface
 *  No default return type
 */
export interface IQueryHandler<TQuery extends IQuery, TResult>{
  execute(query: TQuery): Promise<TResult>; 
}