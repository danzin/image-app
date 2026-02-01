import { Router, Request, Response, text } from "express";
import { injectable, inject } from "tsyringe";
import { TelemetryService } from "@/services/telemetry.service";
import { AuthFactory, adminRateLimit, enhancedAdminOnly } from "../middleware/authentication.middleware";

@injectable()
export class TelemetryRoutes {
	private readonly router: Router;

	constructor(@inject("TelemetryService") private readonly telemetryService: TelemetryService) {
		this.router = Router();
		this.initializeRoutes();
	}

	private initializeRoutes(): void {
		const optionalAuth = AuthFactory.optionalBearerToken().handleOptional();

		// receive telemetry events from frontend
		// use text() middleware to handle sendBeacon which sends as text/plain
		this.router.post("/", optionalAuth, text({ type: "*/*" }), async (req: Request, res: Response) => {
			try {
				// handle sendBeacon which might send as text/plain
				let body = req.body;
				if (typeof body === "string") {
					try {
						body = JSON.parse(body);
					} catch {
						res.status(400).json({ error: "invalid JSON" });
						return;
					}
				}

				const { events } = body;

				if (!Array.isArray(events)) {
					res.status(400).json({ error: "events must be an array" });
					return;
				}

				// extract client info for context
				const clientInfo = {
					ip: req.ip || req.socket.remoteAddress,
					userAgent: req.get("User-Agent"),
					userId: (req as any).decodedUser?.publicId,
				};

				await this.telemetryService.processEvents(events, clientInfo);

				res.status(204).send();
			} catch {
				// telemetry should fail silently from client perspective
				res.status(204).send();
			}
		});

		// get aggregated metrics
		const auth = AuthFactory.bearerToken().handle();
		this.router.get("/summary", auth, adminRateLimit, enhancedAdminOnly, async (_req: Request, res: Response) => {
			try {
				const summary = await this.telemetryService.getSummary();
				res.json(summary);
			} catch (error) {
				const message = error instanceof Error ? error.message : "Failed to get summary";
				res.status(500).json({ error: message });
			}
		});
	}

	getRouter(): Router {
		return this.router;
	}
}
