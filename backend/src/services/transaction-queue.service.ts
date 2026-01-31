import { injectable, inject } from "tsyringe";
import { ClientSession } from "mongoose";
import { UnitOfWork } from "@/database/UnitOfWork";
import { logger } from "@/utils/winston";

/**
 * Priority levels for queued transactions
 */
export type TransactionPriority = "critical" | "high" | "normal" | "low";

/**
 * Queued transaction item
 */
interface QueuedTransaction<T = any> {
	id: string;
	priority: TransactionPriority;
	work: (session: ClientSession) => Promise<T>;
	resolve: (value: T) => void;
	reject: (error: any) => void;
	createdAt: number;
	attempts: number;
	maxAttempts: number;
}

/**
 * TransactionQueueService provides a queue-based approach for handling
 * high-concurrency scenarios where transactions might conflict
 *
 * Use this for:
 * - non-time-critical operations that can be deferred
 * - smoothing out load spikes
 * - priority-based processing
 */
@injectable()
export class TransactionQueueService {
	private readonly queues: Map<TransactionPriority, QueuedTransaction[]> = new Map([
		["critical", []],
		["high", []],
		["normal", []],
		["low", []],
	]);

	private isProcessing = false;
	private readonly maxQueueSize = 1000;
	private readonly processingInterval = 50; // ms between processing batches
	private intervalHandle: NodeJS.Timeout | null = null;

	// metrics
	private metrics = {
		totalEnqueued: 0,
		totalProcessed: 0,
		totalFailed: 0,
		totalDropped: 0,
	};

	constructor(@inject("UnitOfWork") private readonly unitOfWork: UnitOfWork) {}

	/**
	 * Enqueue a transaction for deferred processing
	 * Returns a promise that resolves when the transaction completes
	 */
	async enqueue<T>(
		work: (session: ClientSession) => Promise<T>,
		options?: {
			priority?: TransactionPriority;
			maxAttempts?: number;
			timeout?: number;
		}
	): Promise<T> {
		const priority = options?.priority ?? "normal";
		const queue = this.queues.get(priority)!;

		// check queue size limits
		if (this.getTotalQueueSize() >= this.maxQueueSize) {
			this.metrics.totalDropped++;
			throw new Error("Transaction queue is full, please try again later");
		}

		return new Promise<T>((resolve, reject) => {
			const transaction: QueuedTransaction<T> = {
				id: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
				priority,
				work,
				resolve,
				reject,
				createdAt: Date.now(),
				attempts: 0,
				maxAttempts: options?.maxAttempts ?? 3,
			};

			queue.push(transaction);
			this.metrics.totalEnqueued++;

			// set timeout if specified
			if (options?.timeout) {
				setTimeout(() => {
					const index = queue.indexOf(transaction);
					if (index > -1) {
						queue.splice(index, 1);
						reject(new Error("Transaction timed out in queue"));
					}
				}, options.timeout);
			}

			// start processing if not already running
			this.startProcessing();
		});
	}

	/**
	 * Execute a transaction immediately if system is not under load
	 * otherwise queue it for deferred processing
	 */
	async executeOrQueue<T>(
		work: (session: ClientSession) => Promise<T>,
		options?: {
			priority?: TransactionPriority;
			loadThreshold?: number;
		}
	): Promise<T> {
		const uowMetrics = this.unitOfWork.getMetrics();
		const loadThreshold = options?.loadThreshold ?? 40;

		// if system is under load, queue the transaction
		if (uowMetrics.currentQueueLength > loadThreshold || uowMetrics.availablePermits < 5) {
			logger.info("[TransactionQueue] System under load, queueing transaction", {
				queueLength: uowMetrics.currentQueueLength,
				availablePermits: uowMetrics.availablePermits,
			});
			return this.enqueue(work, options);
		}

		// otherwise execute immediately
		return this.unitOfWork.executeInTransaction(work);
	}

	/**
	 * Start the queue processing loop
	 */
	private startProcessing(): void {
		if (this.isProcessing) return;

		this.isProcessing = true;
		this.intervalHandle = setInterval(() => this.processNextBatch(), this.processingInterval);
	}

	/**
	 * Stop the queue processing loop
	 */
	stopProcessing(): void {
		if (this.intervalHandle) {
			clearInterval(this.intervalHandle);
			this.intervalHandle = null;
		}
		this.isProcessing = false;
	}

	/**
	 * Process the next batch of transactions from the queue
	 */
	private async processNextBatch(): Promise<void> {
		const uowMetrics = this.unitOfWork.getMetrics();

		// don't process if system is overloaded
		if (uowMetrics.availablePermits < 5) {
			return;
		}

		// determine how many to process based on available capacity
		const batchSize = Math.min(uowMetrics.availablePermits - 2, 10);
		const transactions: QueuedTransaction[] = [];

		// get transactions by priority
		for (const priority of ["critical", "high", "normal", "low"] as TransactionPriority[]) {
			const queue = this.queues.get(priority)!;
			while (transactions.length < batchSize && queue.length > 0) {
				transactions.push(queue.shift()!);
			}
		}

		if (transactions.length === 0) {
			// no more work, stop processing
			this.stopProcessing();
			return;
		}

		// process transactions in parallel
		await Promise.all(
			transactions.map(async (txn) => {
				try {
					txn.attempts++;
					const result = await this.unitOfWork.executeInTransaction(txn.work);
					this.metrics.totalProcessed++;
					txn.resolve(result);
				} catch (error) {
					if (txn.attempts < txn.maxAttempts) {
						// re-queue with same priority
						const queue = this.queues.get(txn.priority)!;
						queue.unshift(txn); // add to front for retry
						logger.warn(`[TransactionQueue] Retrying transaction ${txn.id}`, {
							attempt: txn.attempts,
							maxAttempts: txn.maxAttempts,
						});
					} else {
						this.metrics.totalFailed++;
						logger.error(`[TransactionQueue] Transaction ${txn.id} failed after ${txn.attempts} attempts`);
						txn.reject(error);
					}
				}
			})
		);
	}

	/**
	 * Get total items across all queues
	 */
	getTotalQueueSize(): number {
		let total = 0;
		for (const queue of this.queues.values()) {
			total += queue.length;
		}
		return total;
	}

	/**
	 * Get queue sizes by priority
	 */
	getQueueSizes(): Record<TransactionPriority, number> {
		return {
			critical: this.queues.get("critical")!.length,
			high: this.queues.get("high")!.length,
			normal: this.queues.get("normal")!.length,
			low: this.queues.get("low")!.length,
		};
	}

	/**
	 * Get queue metrics
	 */
	getMetrics(): typeof this.metrics & { queueSizes: Record<TransactionPriority, number> } {
		return {
			...this.metrics,
			queueSizes: this.getQueueSizes(),
		};
	}

	/**
	 * Clear all queues (for testing/shutdown)
	 */
	clearQueues(): void {
		for (const [, queue] of this.queues) {
			while (queue.length > 0) {
				const txn = queue.pop()!;
				txn.reject(new Error("Queue cleared"));
			}
		}
	}
}
