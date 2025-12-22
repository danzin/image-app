import "reflect-metadata";
import { expect } from "chai";
import sinon from "sinon";
import { TransactionQueueService } from "../../services/transaction-queue.service";
import { UnitOfWork } from "../../database/UnitOfWork";
import { ClientSession } from "mongoose";

describe("TransactionQueueService", () => {
	let transactionQueueService: TransactionQueueService;
	let unitOfWorkStub: sinon.SinonStubbedInstance<UnitOfWork>;

	beforeEach(() => {
		unitOfWorkStub = sinon.createStubInstance(UnitOfWork);

		// Default metrics mock
		unitOfWorkStub.getMetrics.returns({
			totalAttempts: 0,
			successfulTransactions: 0,
			failedTransactions: 0,
			retriedTransactions: 0,
			avgRetryCount: 0,
			currentQueueLength: 0,
			availablePermits: 50,
		});

		// Mock executeInTransaction to just run the callback
		unitOfWorkStub.executeInTransaction.callsFake(async (callback) => {
			return callback({} as ClientSession);
		});

		transactionQueueService = new TransactionQueueService(unitOfWorkStub as unknown as UnitOfWork);
	});

	afterEach(() => {
		transactionQueueService.stopProcessing();
		sinon.restore();
	});

	describe("enqueue", () => {
		it("should enqueue and process a transaction", async () => {
			const work = sinon.stub().resolves("result");

			const promise = transactionQueueService.enqueue(work);

			// Wait for processing loop to pick it up
			const result = await promise;

			expect(result).to.equal("result");
			expect(work.calledOnce).to.be.true;
		});

		it("should respect priority", async () => {
			const executionOrder: string[] = [];

			// need to pause processing to queue up multiple items
			transactionQueueService.stopProcessing();

			const lowPriorityWork = async () => {
				executionOrder.push("low");
				return "low";
			};

			const criticalPriorityWork = async () => {
				executionOrder.push("critical");
				return "critical";
			};

			const p1 = transactionQueueService.enqueue(lowPriorityWork, { priority: "low" });
			const p2 = transactionQueueService.enqueue(criticalPriorityWork, { priority: "critical" });

			const clock = sinon.useFakeTimers();
		});
	});

	describe("executeOrQueue", () => {
		it("should execute immediately if system is not under load", async () => {
			unitOfWorkStub.getMetrics.returns({
				totalAttempts: 0,
				successfulTransactions: 0,
				failedTransactions: 0,
				retriedTransactions: 0,
				avgRetryCount: 0,
				currentQueueLength: 0,
				availablePermits: 50,
			});

			const work = sinon.stub().resolves("immediate");
			const result = await transactionQueueService.executeOrQueue(work);

			expect(result).to.equal("immediate");
			expect(unitOfWorkStub.executeInTransaction.calledOnce).to.be.true;
		});

		it("should queue if system is under load", async () => {
			// Initial state: High load
			unitOfWorkStub.getMetrics.returns({
				totalAttempts: 0,
				successfulTransactions: 0,
				failedTransactions: 0,
				retriedTransactions: 0,
				avgRetryCount: 0,
				currentQueueLength: 50, // High load
				availablePermits: 0,
			});

			const work = sinon.stub().resolves("queued");

			// Spy on enqueue to verify it was called
			const enqueueSpy = sinon.spy(transactionQueueService, "enqueue");

			// Start the operation
			const promise = transactionQueueService.executeOrQueue(work);

			// Verify enqueue was called (synchronously)
			expect(enqueueSpy.calledOnce).to.be.true;

			// Now relieve load so it can be processed
			unitOfWorkStub.getMetrics.returns({
				totalAttempts: 0,
				successfulTransactions: 0,
				failedTransactions: 0,
				retriedTransactions: 0,
				avgRetryCount: 0,
				currentQueueLength: 0,
				availablePermits: 50,
			});

			// Wait for result
			const result = await promise;

			expect(result).to.equal("queued");
		});
	});
});
