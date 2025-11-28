import { IQueryHandler } from "../interfaces/query-handler.interface";
import { IQuery } from "../interfaces/query.interface";

export class QueryBus {
	// Stores query handlers, mapping query names to their respective handlerss
	private handlers = new Map<string, IQueryHandler<IQuery, any>>();

	/**
	 * Registers a query handler for a specific query type.
	 * @param queryType - The class constructor of the query type.
	 * @param handler - The handler responsible for processing the query.
	 */
	register<TQuery extends IQuery, TResult>(
		queryType: { new (...args: any[]): IQuery },
		handler: IQueryHandler<TQuery, TResult>
	): void {
		this.handlers.set(queryType.name, handler as IQueryHandler<IQuery, any>);
	}

	/**
	 * Executes a query by finding its corresponding handler.
	 * @param query - The query instance to be processed.
	 * @returns The result of the query execution.
	 * @throws An error if no handler is found for the query.
	 */
	async execute<TResult>(query: IQuery): Promise<TResult> {
		const handler = this.handlers.get(query.constructor.name);

		if (!handler) {
			throw new Error(`No handler found for query ${query.constructor.name}`);
		}

		return handler.execute(query) as Promise<TResult>;
	}
}
