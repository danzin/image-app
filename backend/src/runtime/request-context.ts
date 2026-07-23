import { AsyncLocalStorage } from "node:async_hooks";

export type RequestContextBreadcrumbValue = string | number | boolean;

export type RequestContextBreadcrumb = {
  at: string;
  offsetMs?: number;
  event: string;
  data?: Record<string, RequestContextBreadcrumbValue>;
};

export type RequestContext = {
  correlationId: string;
  requestStartTime?: bigint;
  method?: string;
  requestPath?: string;
  userId?: string;
  clientRequestId?: string;
  clientBootId?: string;
  previousClientRequestId?: string;
  causedByClientRequestId?: string;
  breadcrumbs: RequestContextBreadcrumb[];
};

export type ReadonlyRequestContextBreadcrumb = Readonly<
  Omit<RequestContextBreadcrumb, "data">
> & {
  readonly data?: Readonly<Record<string, RequestContextBreadcrumbValue>>;
};

export type ReadonlyRequestContext = Readonly<
  Omit<RequestContext, "breadcrumbs">
> & {
  readonly breadcrumbs: readonly ReadonlyRequestContextBreadcrumb[];
};

export type RequestContextInput = Omit<RequestContext, "breadcrumbs">;

const MAX_BREADCRUMBS = 20;
const MAX_BREADCRUMB_DATA_ENTRIES = 8;
const MAX_BREADCRUMB_EVENT_LENGTH = 128;
const MAX_BREADCRUMB_KEY_LENGTH = 64;
const MAX_BREADCRUMB_STRING_LENGTH = 512;
const SENSITIVE_BREADCRUMB_KEY_PATTERN =
  /password|passphrase|token|secret|authorization|cookie|api[-_]?key|jwt|email|username|handle|user[-_]?id|ip|origin|referrer|useragent|session|refresh|body|query|document/i;

const requestContextALS = new AsyncLocalStorage<RequestContext>();

export function runWithRequestContext<T>(
  context: RequestContextInput,
  work: () => T,
): T {
  return requestContextALS.run(
    {
      ...context,
      breadcrumbs: [],
    },
    work,
  );
}

function getMutableRequestContext(): RequestContext | undefined {
  return requestContextALS.getStore();
}

export function getRequestContext(): ReadonlyRequestContext | undefined {
  return getMutableRequestContext();
}

export function getCorrelationId(): string | undefined {
  return getRequestContext()?.correlationId;
}

export function getClientRequestId(): string | undefined {
  return getRequestContext()?.clientRequestId;
}

export function getClientBootId(): string | undefined {
  return getRequestContext()?.clientBootId;
}

export function setRequestContextUserId(userId: string): void {
  const context = getMutableRequestContext();
  if (!context) {
    return;
  }

  context.userId = userId;
}

export function addRequestContextBreadcrumb(
  event: string,
  data?: Record<string, RequestContextBreadcrumbValue>,
): void {
  const context = getMutableRequestContext();
  const normalizedEvent = normalizeBreadcrumbEvent(event);
  if (!context || !normalizedEvent) {
    return;
  }

  const offsetMs = getBreadcrumbOffsetMs(context);
  const sanitizedData = sanitizeBreadcrumbData(data);
  const breadcrumb: RequestContextBreadcrumb = {
    at: new Date().toISOString(),
    event: normalizedEvent,
    ...(offsetMs === undefined ? {} : { offsetMs }),
    ...(sanitizedData ? { data: sanitizedData } : {}),
  };

  context.breadcrumbs.push(breadcrumb);
  if (context.breadcrumbs.length > MAX_BREADCRUMBS) {
    context.breadcrumbs.splice(0, context.breadcrumbs.length - MAX_BREADCRUMBS);
  }
}

function normalizeBreadcrumbEvent(event: string): string | undefined {
  if (typeof event !== "string") {
    return undefined;
  }

  const normalized = event.trim();
  if (!normalized || normalized.length > MAX_BREADCRUMB_EVENT_LENGTH) {
    return undefined;
  }

  return normalized;
}

function getBreadcrumbOffsetMs(context: RequestContext): number | undefined {
  if (context.requestStartTime === undefined) {
    return undefined;
  }

  const offsetMs =
    Number(process.hrtime.bigint() - context.requestStartTime) / 1_000_000;
  return Number.isFinite(offsetMs) && offsetMs >= 0 ? offsetMs : undefined;
}

function sanitizeBreadcrumbData(
  data: Record<string, RequestContextBreadcrumbValue> | undefined,
): Record<string, RequestContextBreadcrumbValue> | undefined {
  if (!data || typeof data !== "object") {
    return undefined;
  }

  let entries: [string, unknown][];
  try {
    entries = Object.entries(data);
  } catch {
    return undefined;
  }

  const sanitized = Object.create(null) as Record<
    string,
    RequestContextBreadcrumbValue
  >;
  let accepted = 0;

  for (const [rawKey, rawValue] of entries) {
    if (accepted >= MAX_BREADCRUMB_DATA_ENTRIES) {
      break;
    }

    const key = rawKey.trim().slice(0, MAX_BREADCRUMB_KEY_LENGTH);
    if (!key || SENSITIVE_BREADCRUMB_KEY_PATTERN.test(key)) {
      continue;
    }

    if (typeof rawValue === "string") {
      sanitized[key] = rawValue.slice(0, MAX_BREADCRUMB_STRING_LENGTH);
    } else if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
      sanitized[key] = rawValue;
    } else if (typeof rawValue === "boolean") {
      sanitized[key] = rawValue;
    } else {
      continue;
    }

    accepted += 1;
  }

  return accepted > 0 ? sanitized : undefined;
}
