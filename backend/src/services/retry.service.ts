import { injectable } from "tsyringe";
import { logger } from "../utils/winston";

/**
 * Configuration for retry operations
 */
export interface RetryConfig {
	maxAttempts?: number;
	baseDelayMs?: number;
	maxDelayMs?: number;
	shouldRetry?: (error: any) => boolean;
	onRetry?: (attempt: number, error: any) => void;
}

const DEFAULT_CONFIG: Required<Omit<RetryConfig, "shouldRetry" | "onRetry">> = {
	maxAttempts: 5,
	baseDelayMs: 100,
	maxDelayMs: 10000,
};

/**
 * RetryService provides retry logic with exponential backoff
 * Use this for operations that don't need full MongoDB transactions
 * but still benefit from automatic retry on transient failures
 */
@injectable()
export class RetryService {
	/**
	 * Execute an operation with automatic retry on failure
	 */
	async execute<T>(operation: () => Promise<T>, config?: RetryConfig): Promise<T> {
		const cfg = { ...DEFAULT_CONFIG, ...config };
		let lastError: Error | undefined;

		for (let attempt = 1; attempt <= cfg.maxAttempts; attempt++) {
			try {
				return await operation();
			} catch (error: any) {
				lastError = error;

				const shouldRetry = cfg.shouldRetry ? cfg.shouldRetry(error) : this.isRetryableError(error);

				if (!shouldRetry || attempt >= cfg.maxAttempts) {
					logger.error(`[RetryService] Operation failed after ${attempt} attempts`, {
						error: error?.message,
						stack: error?.stack?.substring(0, 500),
					});
					throw error;
				}

				if (cfg.onRetry) {
					cfg.onRetry(attempt, error);
				}

				logger.warn(`[RetryService] Attempt ${attempt}/${cfg.maxAttempts} failed, retrying...`, {
					error: error?.message?.substring(0, 100),
				});

				await this.backoffWithJitter(attempt, cfg.baseDelayMs, cfg.maxDelayMs);
			}
		}

		throw lastError || new Error("Retry exhausted without error");
	}

	/**
	 * Execute multiple operations in parallel with individual retry
	 * Useful for batch operations where individual failures shouldn't fail the whole batch
	 */
	async executeAll<T>(
		operations: Array<() => Promise<T>>,
		config?: RetryConfig & { continueOnError?: boolean }
	): Promise<Array<{ success: true; result: T } | { success: false; error: Error }>> {
		const results = await Promise.all(
			operations.map(async (op) => {
				try {
					const result = await this.execute(op, config);
					return { success: true as const, result };
				} catch (error) {
					if (!config?.continueOnError) {
						throw error;
					}
					return { success: false as const, error: error as Error };
				}
			})
		);
		return results;
	}

	/**
	 * Check if an error is generally retryable
	 */
	private isRetryableError(error: any): boolean {
		if (!error) return false;

		// MongoDB specific error codes
		const retryableCodes = new Set([
			112, // WriteConflict
			11600, // InterruptedAtShutdown
			11602, // InterruptedDueToReplStateChange
			189, // PrimarySteppedDown
			91, // ShutdownInProgress
			10107, // NotWritablePrimary
			13435, // NotPrimaryNoSecondaryOk
			64, // WriteConcernFailed
			11000, // DuplicateKey - sometimes transient in race conditions
		]);

		if (error.code && retryableCodes.has(error.code)) {
			return true;
		}

		// Network/connection errors
		const message = typeof error.message === "string" ? error.message.toLowerCase() : "";
		const retryableMessages = [
			"econnreset",
			"econnrefused",
			"etimedout",
			"socket hang up",
			"network error",
			"connection",
			"write conflict",
			"please retry",
			"timeout",
			"busy",
		];

		return retryableMessages.some((msg) => message.includes(msg));
	}

	/**
	 * Exponential backoff with full jitter
	 */
	private async backoffWithJitter(attempt: number, baseMs: number, maxMs: number): Promise<void> {
		const exponentialDelay = Math.min(baseMs * Math.pow(2, attempt - 1), maxMs);
		const jitteredDelay = Math.floor(Math.random() * exponentialDelay);
		const finalDelay = Math.max(jitteredDelay, 10);
		return new Promise((resolve) => setTimeout(resolve, finalDelay));
	}
}

/**
 * Helper function for creating retry configs for specific scenarios
 */
export const RetryPresets = {
	/**
	 * For database operations with moderate retry
	 */
	database: (): RetryConfig => ({
		maxAttempts: 5,
		baseDelayMs: 50,
		maxDelayMs: 5000,
	}),

	/**
	 * For external API calls with longer delays
	 */
	externalApi: (): RetryConfig => ({
		maxAttempts: 3,
		baseDelayMs: 500,
		maxDelayMs: 15000,
	}),

	/**
	 * For critical operations that must succeed
	 */
	critical: (): RetryConfig => ({
		maxAttempts: 10,
		baseDelayMs: 100,
		maxDelayMs: 30000,
	}),

	/**
	 * For fast operations where quick retry is preferred
	 */
	fast: (): RetryConfig => ({
		maxAttempts: 3,
		baseDelayMs: 25,
		maxDelayMs: 500,
	}),
};
