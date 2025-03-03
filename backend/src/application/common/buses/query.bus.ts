import { IQueryHandler } from "../interfaces/query-handler.interface";
import { IQuery } from "../interfaces/query.interface";


export class QueryBus {
  private handlers = new Map<string, IQueryHandler<IQuery, any>>()

  register<TQuery extends IQuery, TResult>(
    queryType: { new(...args: any[]): IQuery },
    handler: IQueryHandler<TQuery, TResult>
  ) : void
  {
    this.handlers.set(queryType.name, handler as IQueryHandler<IQuery, any> )
  }

  async execute<TResult>(query: IQuery) : Promise<TResult> {
    const handler = this.handlers.get(query.constructor.name);

    if(!handler){
      throw new Error(`No handler found for query ${query.constructor.name}`);
    }

    return handler.execute(query) as Promise<TResult>;

  }

}