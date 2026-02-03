import "reflect-metadata";
import { expect } from "chai";
import sinon from "sinon";
import { RedisService } from "@/services/redis.service";
import { MetricsService } from "@/metrics/metrics.service";

describe("RedisService", () => {
	let redisService: RedisService;
	let metricsServiceStub: sinon.SinonStubbedInstance<MetricsService>;
	let mockClient: any;

	beforeEach(() => {
		metricsServiceStub = sinon.createStubInstance(MetricsService);

		// Mock the client before instantiating RedisService so the constructor doesn't open real sockets
		mockClient = {
			on: sinon.stub().returnsThis(),
			connect: sinon.stub().resolves(),
			quit: sinon.stub().resolves(),
			get: sinon.stub(),
			set: sinon.stub(),
			del: sinon.stub(),
			multi: sinon.stub(),
		};

		redisService = new RedisService(metricsServiceStub as unknown as MetricsService);
		(redisService as any).client = mockClient;
	});

	afterEach(() => {
		sinon.restore();
	});

	describe("withResilience", () => {
		it("should execute operation successfully", async () => {
			const operation = sinon.stub().resolves("success");

			// Access private method via any cast
			const result = await (redisService as any).withResilience(operation);

			expect(result).to.equal("success");
			expect(operation.calledOnce).to.be.true;
		});

		it("should retry on retryable error", async () => {
			const operation = sinon.stub();
			const error = new Error("Connection lost");
			(error as any).code = "ECONNRESET"; // Retryable code

			operation.onCall(0).rejects(error);
			operation.onCall(1).resolves("success");

			const result = await (redisService as any).withResilience(operation, {
				maxAttempts: 3,
				baseDelayMs: 1,
			});

			expect(result).to.equal("success");
			expect(operation.calledTwice).to.be.true;
		});

		it("should return fallback value on failure if provided", async () => {
			const operation = sinon.stub().rejects(new Error("Fatal"));

			const result = await (redisService as any).withResilience(operation, {
				maxAttempts: 1,
				fallbackValue: "fallback",
			});

			expect(result).to.equal("fallback");
		});
	});

	describe("setWithTags", () => {
		it("should use resilience wrapper", async () => {
			// Spy on withResilience
			const withResilienceSpy = sinon.spy(redisService as any, "withResilience");

			// Mock pipeline
			const pipelineStub = {
				set: sinon.stub(),
				setEx: sinon.stub(),
				sAdd: sinon.stub(),
				expire: sinon.stub(),
				exec: sinon.stub().resolves(),
			};
			mockClient.multi.returns(pipelineStub);

			// Mock ensureSetKey (private)
			(redisService as any).ensureSetKey = sinon.stub().resolves();

			await redisService.setWithTags("key", "value", ["tag1"]);

			expect(withResilienceSpy.calledOnce).to.be.true;
			expect(pipelineStub.exec.calledOnce).to.be.true;
		});
	});
});
