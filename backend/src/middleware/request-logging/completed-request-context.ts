import type { Request, Response } from "express";
import { getCorrelationId } from "@/runtime/request-context";
import { getClientIp } from "@/utils/request-ip";

export interface AuthLogMetadata {
  authAction?: string;
  userId?: string;
  authEmail?: string;
  authUsername?: string;
  authHandle?: string;
  sessionId?: string;
  tokenFamilyId?: string;
  authState?: string;
  authSource?: string;
  refreshRotated?: boolean;
}

declare module "express-serve-static-core" {
  interface Request {
    authLogMetadata?: AuthLogMetadata;
    correlationId?: string;
    clientRequestId?: string;
    clientBootId?: string;
    clientRequestAttempt?: number;
    axiosRetry?: boolean;
    previousClientRequestId?: string;
    causedByClientRequestId?: string;
    authSource?: string;
  }
}

export interface CompletedRequestContext {
  method: string;
  route: string;
  ip: string;
  origin?: string;
  statusCode: number;
  responseTimeMs: number;
  correlationId?: string;
  userId?: string;
  userAgent?: string;
  authState: string;
  authSource: string;
  authAction?: string;
  authEmail?: string;
  authUsername?: string;
  authHandle?: string;
  sessionId?: string;
  tokenFamilyId?: string;
  clientRequestId?: string;
  clientBootId?: string;
  clientRequestAttempt?: number;
  axiosRetry?: boolean;
  previousClientRequestId?: string;
  causedByClientRequestId?: string;
  refreshRotated?: boolean;
}

export function getRequestRoute(req: Request): string {
  return (req.originalUrl || req.url).split("?")[0];
}

export function shouldSkipRequestLogging(route: string): boolean {
  return (
    route === "/health" ||
    route.startsWith("/metrics") ||
    route.startsWith("/telemetry")
  );
}

export function buildCompletedRequestContext(
  req: Request,
  res: Response,
  route: string,
  startTime: number,
): CompletedRequestContext {
  const authMetadata = req.authLogMetadata ?? {};
  const userId = authMetadata.userId ?? req.decodedUser?.publicId;
  const sessionId = authMetadata.sessionId ?? req.decodedUser?.sid;

  return {
    method: req.method,
    route,
    ip: getClientIp(req),
    origin: req.get("origin"),
    statusCode: res.statusCode,
    responseTimeMs: Date.now() - startTime,
    correlationId: req.correlationId ?? getCorrelationId(),
    userId,
    userAgent: req.get("user-agent"),
    authState: resolveAuthState(
      authMetadata.authState,
      userId,
      res.statusCode,
    ),
    authSource: resolveAuthSource(authMetadata.authSource, req, userId),
    authAction: authMetadata.authAction,
    authEmail: authMetadata.authEmail ?? req.decodedUser?.email,
    authUsername: authMetadata.authUsername ?? req.decodedUser?.username,
    authHandle: authMetadata.authHandle ?? req.decodedUser?.handle,
    sessionId,
    tokenFamilyId: authMetadata.tokenFamilyId ?? sessionId,
    clientRequestId: req.clientRequestId,
    clientBootId: req.clientBootId,
    clientRequestAttempt: req.clientRequestAttempt,
    axiosRetry: req.axiosRetry,
    previousClientRequestId: req.previousClientRequestId,
    causedByClientRequestId: req.causedByClientRequestId,
    refreshRotated: authMetadata.refreshRotated,
  };
}

function resolveAuthState(
  configured: string | undefined,
  userId: string | undefined,
  statusCode: number,
): string {
  if (configured) {
    return configured;
  }

  if (userId) {
    return "authenticated";
  }

  if (statusCode === 401 || statusCode === 403) {
    return "auth_failed";
  }

  return "anonymous";
}

function resolveAuthSource(
  configured: string | undefined,
  req: Request,
  userId: string | undefined,
): string {
  if (configured) {
    return configured;
  }

  if (req.authSource) {
    return req.authSource;
  }

  return userId ? "access_token" : "none";
}
