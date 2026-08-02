import type {
  NextFunction,
  Request,
  RequestHandler,
  Response,
} from "express";
import { container } from "tsyringe";
import { CommandBus } from "@/application/common/buses/command.bus";
import { TOKENS } from "@/types/tokens";
import {
  buildCompletedRequestContext,
  getRequestRoute,
  shouldSkipRequestLogging,
} from "./request-logging/completed-request-context";
import { dispatchRequestAudits } from "./request-logging/request-audit";
import { dispatchRequestLog } from "./request-logging/request-log-persistence";
import {
  dispatchUserActivityUpdate,
  UserActivityThrottle,
} from "./request-logging/user-activity-tracker";

let commandBus: CommandBus | null = null;

function getCommandBus(): CommandBus {
  if (!commandBus) {
    commandBus = container.resolve<CommandBus>(TOKENS.CQRS.Commands.Bus);
  }

  return commandBus;
}

function logRequest(
  req: Request,
  res: Response,
  next: NextFunction,
  resolveCommandBus: () => CommandBus,
  activityThrottle: UserActivityThrottle,
): void {
  const startTime = Date.now();

  res.once("finish", () => {
    const route = getRequestRoute(req);
    if (shouldSkipRequestLogging(route)) {
      return;
    }

    const context = buildCompletedRequestContext(
      req,
      res,
      route,
      startTime,
    );
    const resolvedCommandBus = resolveCommandBus();

    dispatchUserActivityUpdate(
      resolvedCommandBus,
      context,
      activityThrottle,
    );
    dispatchRequestLog(resolvedCommandBus, context);
    dispatchRequestAudits(resolvedCommandBus, context);
  });

  next();
}

export function createRequestLogger(
  resolveCommandBus: () => CommandBus = getCommandBus,
): RequestHandler {
  const activityThrottle = new UserActivityThrottle();
  return (req, res, next) =>
    logRequest(req, res, next, resolveCommandBus, activityThrottle);
}

export const requestLogger = createRequestLogger();
