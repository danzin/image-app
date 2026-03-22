import "reflect-metadata";
import { expect } from "chai";
import sinon from "sinon";
import { TransactionQueueService } from "@/services/transaction-queue.service";
import { UnitOfWork } from "@/database/UnitOfWork";
import { RedisService } from "@/services/redis.service";
import { ClientSession } from "mongoose";

describe("TransactionQueueService", () => {
	let transactionQueueService: TransactionQueueService;
	let unitOfWorkStub: sinon.SinonStubbedInstance<UnitOfWork>;
	let redisServiceStub: sinon.SinonStubbedInstance<RedisService>;
	let redisClientStub: any;

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

		redisClientStub = {
			isOpen: true,
			lPush: sinon.stub().resolves(),
			rPush: sinon.stub().resolves(),
			lLen: sinon.stub().resolves(0),
			brPop: sinon.stub().callsFake(async () => {
				await new Promise(resolve => setTimeout(resolve, 10));
				return null;
			}),
			duplicate: sinon.stub().returnsThis(),
			connect: sinon.stub().resolves(),
			quit: sinon.stub().resolves(),
			del: sinon.stub().resolves(),
		};

		redisServiceStub = sinon.createStubInstance(RedisService) as any;
		Object.defineProperty(redisServiceStub, 'clientInstance', {
			get: () => redisClientStub
		});

		transactionQueueService = new TransactionQueueService(
			unitOfWorkStub as unknown as UnitOfWork,
			redisServiceStub as unknown as RedisService
		);
	});

	afterEach(() => {
		transactionQueueService.stopProcessing();
		sinon.restore();
	});

	describe("enqueue", () => {
		it("should enqueue a job correctly to Redis", async () => {
			await transactionQueueService.enqueue("testJob", { data: 123 }, { priority: "high" });

			expect(redisClientStub.lPush.calledOnce).to.be.true;
			const args = redisClientStub.lPush.firstCall.args;
			expect(args[0]).to.equal("queue:high");
            
			const payload = JSON.parse(args[1]);
			expect(payload.jobName).to.equal("testJob");
			expect(payload.payload.data).to.equal(123);
			expect(payload.priority).to.equal("high");
		});
	});

	describe("executeOrQueue", () => {
		beforeEach(() => {
			transactionQueueService.registerHandler("testJob", async (payload: any) => payload.result);
		});

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

			await transactionQueueService.executeOrQueue("testJob", { result: "immediate" });

			expect(unitOfWorkStub.executeInTransaction.calledOnce).to.be.true;
			expect(redisClientStub.lPush.called).to.be.false;
		});

		it("should queue to redis if system is under load", async () => {
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

			await transactionQueueService.executeOrQueue("testJob", { result: "queued" });

			expect(redisClientStub.lPush.calledOnce).to.be.true;
			expect(unitOfWorkStub.executeInTransaction.called).to.be.false;
			
			const args = redisClientStub.lPush.firstCall.args;
			expect(args[0]).to.equal("queue:normal"); // default priority
			const payload = JSON.parse(args[1]);
			expect(payload.jobName).to.equal("testJob");
		});

		it("should throw error if attempting to execute unregistered job immediately", async () => {
			unitOfWorkStub.getMetrics.returns({
				totalAttempts: 0,
				successfulTransactions: 0,
				failedTransactions: 0,
				retriedTransactions: 0,
				avgRetryCount: 0,
				currentQueueLength: 0,
				availablePermits: 50,
			});

			try {
				await transactionQueueService.executeOrQueue("unknownJob", {});
				expect.fail("Should have thrown error");
			} catch (e) {
				expect((e as Error).message).to.include("No handler registered");
			}
		});
	});

	describe("getMetrics", () => {
		it("should retrieve queue sizes from redis", async () => {
			redisClientStub.lLen.resolves(5);
			
			const metrics = await transactionQueueService.getMetrics();
			
			expect(redisClientStub.lLen.callCount).to.equal(4); // once for each priority
			expect(metrics.queueSizes.critical).to.equal(5);
			expect(metrics.queueSizes.low).to.equal(5);
		});
	});
});
