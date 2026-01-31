import { inject, injectable } from "tsyringe";
import { ICommandHandler } from "@/application/common/interfaces/command-handler.interface";
import { LogRequestCommand } from "./logRequest.command";
import { RequestLogRepository } from "@/repositories/requestLog.repository";

@injectable()
export class LogRequestCommandHandler implements ICommandHandler<LogRequestCommand, void> {
	constructor(@inject("RequestLogRepository") private readonly requestLogRepository: RequestLogRepository) {}

	async execute(command: LogRequestCommand): Promise<void> {
		const { method, route, ip, statusCode, responseTimeMs, userId, userAgent } = command.payload;

		await this.requestLogRepository.create({
			timestamp: new Date(),
			metadata: {
				method,
				route,
				ip,
				statusCode,
				responseTimeMs,
				userId,
				userAgent,
			},
		} as any);
	}
}
