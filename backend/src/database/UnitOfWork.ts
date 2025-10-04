import { EventBus } from "../application/common/buses/event.bus";
import mongoose, { ClientSession } from "mongoose";
import { inject, injectable } from "tsyringe";

@injectable()
export class UnitOfWork {
	private session: ClientSession | null = null;

	constructor(@inject("EventBus") private readonly eventBus: EventBus) {
		if (!mongoose.connection.readyState) {
			throw new Error("Database connection not established");
		}
	}

	async executeInTransaction<T>(work: (session: ClientSession) => Promise<T>): Promise<T> {
		const session = await mongoose.startSession();
		let transactionStarted = false;
		let committed = false;

		// Stage of the transaction for better error logging
		let stage: "idle" | "work" | "commit" | "flush" = "idle";

		try {
			session.startTransaction();
			transactionStarted = true;

			stage = "work";
			const result = await work(session);

			stage = "commit";
			await session.commitTransaction();
			committed = true;

			// Flush events affter successful commit
			stage = "flush";
			await this.eventBus.flushTransactionalQueue();

			return result;
		} catch (error) {
			console.error(`[UnitOfWork] Transaction failed during stage "${stage}"`, error);
			if (transactionStarted && !committed) {
				try {
					await session.abortTransaction();
				} catch (abortError) {
					console.error("Failed to abort transaction", abortError);
				}
			}

			// Clear failed events
			this.eventBus.clearTransactionalQueue();
			throw error;
		} finally {
			await session.endSession();
		}
	}

	getSession(): ClientSession | null {
		return this.session;
	}
}
