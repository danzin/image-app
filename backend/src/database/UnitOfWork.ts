import { EventBus } from "../application/common/buses/event.bus";
import mongoose, { ClientSession } from "mongoose";
import { inject, injectable } from "tsyringe";
import { behaviourLogger, errorLogger } from "../utils/winston";

//TODO: Decouple the event bus! Having it so tightly coupled with the UoW is pretty problematic.
// Right now event flush happens inside the transaction logic:
// stage = "flush";
// await this.eventBus.flushTransactionalQueue();
// if This fails, the transaction is already commited - the database is consistent but the event isn't fired.
// Need to think of a way to efficiently decouple them which will both solve the issue and require
// minimal changes to existing code.

@injectable()
export class UnitOfWork {
	constructor(@inject("EventBus") private readonly eventBus: EventBus) {
		if (!mongoose.connection.readyState) {
			throw new Error("Database connection not established");
		}
	}

	async executeInTransaction<T>(work: (session: ClientSession) => Promise<T>, maxRetries = 3): Promise<T> {
		let lastError: Error | null = null;
		const transactionId = this._generateTransactionId();

		// Log transaction start for tracing
		behaviourLogger.info({
			message: "Transaction started",
			transactionId,
			maxRetries,
		});

		// Retry loop - each iteration is a fresh attempt
		for (let attempt = 1; attempt <= maxRetries; attempt++) {
			try {
				const result = await this._executeSingleAttempt(work, transactionId, attempt);

				// Log successful completion
				behaviourLogger.info({
					message: "Transaction completed successfully",
					transactionId,
					attempt,
					totalAttempts: attempt,
				});

				return result;
			} catch (error) {
				lastError = error as Error;

				// Check if this error is worth retrying
				const isTransient = this._isTransientError(error);
				const isLastAttempt = attempt === maxRetries;

				// Log the failure
				const logData = {
					message: "Transaction attempt failed",
					transactionId,
					attempt,
					maxRetries,
					isTransient,
					isLastAttempt,
					errorMessage: lastError.message,
					errorCode: (error as any).code,
					errorLabels: (error as any).errorLabels,
				};

				if (isTransient && !isLastAttempt) {
					// This is a warning because a retry will follow
					behaviourLogger.warn(logData);
				} else {
					// This is an error - no retries
					errorLogger.error({
						...logData,
						stack: lastError.stack,
						context: "UnitOfWork.executeInTransaction",
					});
				}

				if (!isTransient || isLastAttempt) {
					throw error;
				}

				// Wait before retrying
				const delayMs = Math.pow(2, attempt - 1) * 100;

				behaviourLogger.info({
					message: "Retrying transaction after delay",
					transactionId,
					attempt: attempt + 1,
					delayMs,
				});

				await this._sleep(delayMs);
			}
		}

		throw lastError!;
	}

	/**
	 * Executes a single transaction attempt.
	 */
	private async _executeSingleAttempt<T>(
		work: (session: ClientSession) => Promise<T>,
		transactionId: string,
		attempt: number
	): Promise<T> {
		const session = await mongoose.startSession();
		let transactionStarted = false;
		let committed = false;

		// better error logging
		let stage: "idle" | "work" | "commit" | "flush" = "idle";

		try {
			session.startTransaction();
			transactionStarted = true;

			behaviourLogger.debug({
				message: "Transaction session started",
				transactionId,
				attempt,
				stage: "start",
			});

			stage = "work";
			const result = await work(session);

			behaviourLogger.debug({
				message: "Work completed, committing",
				transactionId,
				attempt,
				stage: "commit",
			});

			stage = "commit";
			await session.commitTransaction();
			committed = true;

			behaviourLogger.debug({
				message: "Transaction committed, flushing events",
				transactionId,
				attempt,
				stage: "flush",
			});

			// Flush events after successful commit
			stage = "flush";
			await this.eventBus.flushTransactionalQueue();

			return result;
		} catch (error) {
			// Log with full context
			errorLogger.error({
				context: "UnitOfWork._executeSingleAttempt",
				message: `Transaction failed during stage "${stage}"`,
				transactionId,
				attempt,
				stage,
				errorMessage: error instanceof Error ? error.message : String(error),
				errorCode: (error as any).code,
				stack: error instanceof Error ? error.stack : undefined,
			});

			if (transactionStarted && !committed) {
				try {
					await session.abortTransaction();

					behaviourLogger.info({
						message: "Transaction aborted",
						transactionId,
						attempt,
						stage,
					});
				} catch (abortError) {
					// Critical - couldn't even abort
					errorLogger.error({
						context: "UnitOfWork._executeSingleAttempt.abort",
						message: "Failed to abort transaction",
						transactionId,
						attempt,
						originalError: error instanceof Error ? error.message : String(error),
						abortErrorMessage: abortError instanceof Error ? abortError.message : String(abortError),
						stack: abortError instanceof Error ? abortError.stack : undefined,
					});
				}
			}

			// Clear failed events
			this.eventBus.clearTransactionalQueue();

			behaviourLogger.debug({
				message: "Transactional event queue cleared",
				transactionId,
				attempt,
			});

			throw error;
		} finally {
			await session.endSession();

			behaviourLogger.debug({
				message: "Session ended",
				transactionId,
				attempt,
			});
		}
	}

	/**
	 * Determines if an error is transient and worth retrying.
	 */
	private _isTransientError(error: any): boolean {
		// Mongodb puts these labels to transient errors
		if (error.hasErrorLabel && error.hasErrorLabel("TransientTransactionError")) {
			return true;
		}

		// Common MongoDB transient error codes
		const transientErrorCodes = [
			112, // WriteConflict - two transactions tried to modify the same document
			13436, // NotPrimaryNoSecondaryOk - replica set is re-electing a primary
			189, // PrimarySteppedDown -
			91, // ShutdownInProgress
			11600, // InterruptedAtShutdown
			11602, // InterruptedDueToReplStateChange
			10107, // NotWritablePrimary
			13435, // NotPrimaryOrSecondary
		];

		return error.code !== undefined && transientErrorCodes.includes(error.code);
	}

	/**
	 * Sleep utility for exponential backoff.
	 */
	private _sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	/**
	 * Generates a unique ID for tracing a transaction across retries and logs.
	 */
	private _generateTransactionId(): string {
		return `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
	}
}
