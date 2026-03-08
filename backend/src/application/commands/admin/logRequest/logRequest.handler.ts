import { inject, injectable } from "tsyringe";
import { ICommandHandler } from "@/application/common/interfaces/command-handler.interface";
import { LogRequestCommand } from "./logRequest.command";
import { RequestLogRepository } from "@/repositories/requestLog.repository";
import { IUserWriteRepository } from "@/repositories/interfaces/IUserWriteRepository";

@injectable()
export class LogRequestCommandHandler implements ICommandHandler<LogRequestCommand, void> {
	constructor(
		@inject("RequestLogRepository") private readonly requestLogRepository: RequestLogRepository,
		@inject("UserWriteRepository") private readonly userWriteRepository: IUserWriteRepository,
	) {}

async execute(command: LogRequestCommand): Promise<void> {
    const { method, route, ip, statusCode, responseTimeMs, userId, userAgent } = command.payload;

    const tasks: Promise<any>[] = [
      this.requestLogRepository.create({
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
      }),
    ];

    if (userId) {
      tasks.push(
        this.userWriteRepository.updateByPublicId(userId, {
          $set: { lastActive: new Date(), lastIp: ip },
        })
      );
    }

    await Promise.allSettled(tasks);
  }
}
