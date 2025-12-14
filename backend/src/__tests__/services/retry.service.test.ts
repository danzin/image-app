import "reflect-metadata";
import { expect } from "chai";
import sinon from "sinon";
import { RetryService, RetryConfig } from "../../services/retry.service";

describe("RetryService", () => {
	let retryService: RetryService;

	beforeEach(() => {
		retryService = new RetryService();
	});

	afterEach(() => {
		sinon.restore();
	});

	describe("execute", () => {
		it("should execute operation successfully on first attempt", async () => {
			const operation = sinon.stub().resolves("success");
			const result = await retryService.execute(operation);

			expect(result).to.equal("success");
			expect(operation.calledOnce).to.be.true;
		});

		it("should retry on failure and eventually succeed", async () => {
			const operation = sinon.stub();
			operation.onCall(0).rejects(new Error("Transient error"));
			operation.onCall(1).resolves("success");

			// smll delay for tests
			const config: RetryConfig = {
				maxAttempts: 3,
				baseDelayMs: 1,
				maxDelayMs: 5,
				shouldRetry: () => true,
			};

			const result = await retryService.execute(operation, config);

			expect(result).to.equal("success");
			expect(operation.calledTwice).to.be.true;
		});

		it("should throw error after max attempts reached", async () => {
			const operation = sinon.stub().rejects(new Error("Persistent error"));

			const config: RetryConfig = {
				maxAttempts: 3,
				baseDelayMs: 1,
				maxDelayMs: 5,
				shouldRetry: () => true,
			};

			try {
				await retryService.execute(operation, config);
				expect.fail("Should have thrown error");
			} catch (error: any) {
				expect(error.message).to.equal("Persistent error");
				expect(operation.callCount).to.equal(3);
			}
		});

		it("should not retry if shouldRetry returns false", async () => {
			const operation = sinon.stub().rejects(new Error("Fatal error"));

			const config: RetryConfig = {
				maxAttempts: 3,
				shouldRetry: () => false,
			};

			try {
				await retryService.execute(operation, config);
				expect.fail("Should have thrown error");
			} catch (error: any) {
				expect(error.message).to.equal("Fatal error");
				expect(operation.calledOnce).to.be.true;
			}
		});
	});

	describe("executeAll", () => {
		it("should execute all operations successfully", async () => {
			const op1 = sinon.stub().resolves(1);
			const op2 = sinon.stub().resolves(2);

			const results = await retryService.executeAll([op1, op2]);

			expect(results).to.have.lengthOf(2);
			expect(results[0]).to.deep.equal({ success: true, result: 1 });
			expect(results[1]).to.deep.equal({ success: true, result: 2 });
		});

		it("should handle failures when continueOnError is true", async () => {
			const op1 = sinon.stub().resolves(1);
			const op2 = sinon.stub().rejects(new Error("Failed"));

			const results = await retryService.executeAll([op1, op2], {
				continueOnError: true,
				maxAttempts: 1,
			});

			expect(results).to.have.lengthOf(2);
			expect(results[0]).to.deep.equal({ success: true, result: 1 });
			expect(results[1].success).to.be.false;
			if (!results[1].success) {
				expect(results[1].error.message).to.equal("Failed");
			}
		});
	});
});
