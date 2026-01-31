import { Router } from "express";
import { injectable, inject } from "tsyringe";
import { MetricsService } from "../metrics/metrics.service";
import { UnitOfWork } from "@/database/UnitOfWork";
import { TransactionQueueService } from "@/services/transaction-queue.service";

@injectable()
export class MetricsRoutes {
	private readonly router: Router;

	constructor(
		@inject("MetricsService") private readonly metricsService: MetricsService,
		@inject("UnitOfWork") private readonly unitOfWork: UnitOfWork,
		@inject("TransactionQueueService") private readonly transactionQueue: TransactionQueueService
	) {
		this.router = Router();
		this.initializeRoutes();
	}

	private initializeRoutes(): void {
		this.router.get("/", async (_req, res) => {
			const metrics = await this.metricsService.getMetrics();
			res.setHeader("Content-Type", this.metricsService.getContentType());
			res.send(metrics);
		});

		// transaction health endpoint for monitoring high-concurrency scenarios
		this.router.get("/transactions", (_req, res) => {
			const uowMetrics = this.unitOfWork.getMetrics();
			const queueMetrics = this.transactionQueue.getMetrics();

			res.json({
				unitOfWork: uowMetrics,
				transactionQueue: queueMetrics,
				health: this.calculateHealth(uowMetrics, queueMetrics),
			});
		});
	}

	private calculateHealth(
		uowMetrics: ReturnType<UnitOfWork["getMetrics"]>,
		queueMetrics: ReturnType<TransactionQueueService["getMetrics"]>
	): "healthy" | "degraded" | "unhealthy" {
		const failureRate = uowMetrics.totalAttempts > 0 ? uowMetrics.failedTransactions / uowMetrics.totalAttempts : 0;

		const queueSize =
			queueMetrics.queueSizes.critical +
			queueMetrics.queueSizes.high +
			queueMetrics.queueSizes.normal +
			queueMetrics.queueSizes.low;

		if (failureRate > 0.2 || queueSize > 500 || uowMetrics.availablePermits < 5) {
			return "unhealthy";
		}
		if (failureRate > 0.05 || queueSize > 100 || uowMetrics.availablePermits < 20) {
			return "degraded";
		}
		return "healthy";
	}

	public getRouter(): Router {
		return this.router;
	}
}
