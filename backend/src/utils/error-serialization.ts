const MAX_ERROR_DEPTH = 4;
const MAX_AGGREGATE_ERRORS = 8;
const MAX_ERROR_LABELS = 8;
const MAX_CONTEXT_ENTRIES = 16;
const MAX_METADATA_ENTRIES = 16;
const MAX_ERROR_NAME_LENGTH = 256;
const MAX_ERROR_MESSAGE_LENGTH = 4_096;
const MAX_ERROR_STACK_LENGTH = 32_768;
const MAX_ERROR_CODE_LENGTH = 256;
const MAX_CONTEXT_STRING_LENGTH = 1_024;
const MAX_LABEL_LENGTH = 128;

const SENSITIVE_KEY_PATTERN =
  /(?:^|_)(?:password|passphrase|token|secret|authorization|cookie|set_cookie|api_key|jwt|bearer|credential|private_key|encryption_key|email|username|handle|session|refresh|request_body|response_body|raw_body|query|filter|update|document|errinfo|origin|referrer|user_agent|ip|ip_address)(?:$|_)/i;
const CONNECTION_STRING_PATTERN =
  /\b([a-z][a-z0-9+.-]*:\/\/)[^/\s:@]+:[^@\s]+@/gi;
const AUTHORIZATION_HEADER_PATTERN = /\bauthorization\s*[:=]\s*[^\r\n]*/gi;
const COOKIE_HEADER_PATTERN =
  /\b(?:set[-_ ]?cookie|cookies?)\s*[:=]\s*[^\r\n]*/gi;
const BEARER_TOKEN_PATTERN = /\bbearer\s+[A-Za-z0-9._~+/=-]+/gi;
const JWT_PATTERN =
  /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const CREDENTIAL_ASSIGNMENT_PATTERN =
  /\b(?:password|passphrase|passwd|pwd|secret|api[-_]?key|access[-_]?token|refresh[-_]?token|client[-_]?secret|token)\s*[:=]\s*["'`]?[^\s"'`,;&]+["'`]?/gi;

type SafeScalar = string | number | boolean;
type SafeRecord = Record<string, SafeScalar>;

export type SerializedError = {
  name: string;
  message: string;
  stack?: string;
  code?: string | number;
  codeName?: string;
  errorLabels?: string[];
  statusCode?: number;
  errorCode?: string;
  context?: SafeRecord;
  keyPattern?: SafeRecord;
  cause?: SerializedError;
  errors?: SerializedError[];
  truncated?: boolean;
};

type SerializationState = {
  active: WeakSet<object>;
};

type SafeTextResult = {
  value: string;
  truncated: boolean;
};

type SafeRecordResult = {
  value?: SafeRecord;
  truncated: boolean;
};

type SafeArrayValue = {
  value?: unknown;
  failed: boolean;
};

function isObjectLike(value: unknown): value is object {
  return (
    (typeof value === "object" && value !== null) || typeof value === "function"
  );
}

function isArray(value: unknown): value is unknown[] {
  try {
    return Array.isArray(value);
  } catch {
    return false;
  }
}

function readProperty(value: object, property: string): unknown {
  try {
    return (value as Record<string, unknown>)[property];
  } catch {
    return undefined;
  }
}

function safePrimitiveString(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (
    typeof value !== "number" &&
    typeof value !== "boolean" &&
    typeof value !== "bigint" &&
    typeof value !== "symbol"
  ) {
    return undefined;
  }

  try {
    return String(value);
  } catch {
    return undefined;
  }
}

function safeObjectTag(value: object): string {
  try {
    return Object.prototype.toString.call(value);
  } catch {
    return "[UnserializableObject]";
  }
}

export function redactSensitiveText(value: string): string {
  return value
    .replace(CONNECTION_STRING_PATTERN, "$1[REDACTED]@")
    .replace(AUTHORIZATION_HEADER_PATTERN, "[REDACTED_AUTHORIZATION]")
    .replace(COOKIE_HEADER_PATTERN, "[REDACTED_COOKIE]")
    .replace(BEARER_TOKEN_PATTERN, "Bearer [REDACTED]")
    .replace(JWT_PATTERN, "[REDACTED_JWT]")
    .replace(CREDENTIAL_ASSIGNMENT_PATTERN, "[REDACTED_CREDENTIAL]");
}

function sanitizeText(value: string, maxLength: number): SafeTextResult {
  const redacted = redactSensitiveText(value);
  return {
    value: redacted.slice(0, maxLength),
    truncated: redacted.length > maxLength,
  };
}

function safeThrownMessage(value: unknown): string {
  if (value === undefined) return "undefined";
  if (value === null) return "null";

  const primitive = safePrimitiveString(value);
  if (primitive !== undefined) return primitive;

  if (isObjectLike(value)) {
    const message = safePrimitiveString(readProperty(value, "message"));
    if (message !== undefined) return message;
    return safeObjectTag(value);
  }

  return "[UnserializableValue]";
}

function isNativeError(value: object): boolean {
  try {
    return value instanceof Error;
  } catch {
    return false;
  }
}

function isErrorLike(value: unknown): value is object {
  if (!isObjectLike(value)) return false;
  if (isNativeError(value)) return true;

  return (
    typeof readProperty(value, "message") === "string" ||
    typeof readProperty(value, "name") === "string"
  );
}

function isAggregateError(value: object): boolean {
  try {
    if (typeof AggregateError !== "undefined" && value instanceof AggregateError) {
      return true;
    }
  } catch {
    // Fall back to the structural check below.
  }

  return (
    readProperty(value, "name") === "AggregateError" &&
    isArray(readProperty(value, "errors"))
  );
}

function getArrayLength(value: unknown): number | undefined {
  if (!isArray(value)) return undefined;
  const length = readProperty(value, "length");
  return typeof length === "number" && Number.isSafeInteger(length) && length >= 0
    ? length
    : undefined;
}

function readArrayValue(value: unknown[], index: number): SafeArrayValue {
  try {
    return { value: value[index], failed: false };
  } catch {
    return { failed: true };
  }
}

function normalizeKey(key: string): string {
  return key
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .toLowerCase();
}

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERN.test(normalizeKey(key));
}

function setRecordValue(record: SafeRecord, key: string, value: SafeScalar): void {
  Object.defineProperty(record, key, {
    configurable: true,
    enumerable: true,
    value,
    writable: true,
  });
}

function serializeSafeRecord(
  value: unknown,
  maxEntries: number,
): SafeRecordResult {
  if (!isObjectLike(value) || isArray(value)) {
    return { truncated: false };
  }

  let keys: string[];
  try {
    keys = Object.keys(value);
  } catch {
    return { truncated: true };
  }

  const record = Object.create(null) as SafeRecord;
  let acceptedEntries = 0;
  let truncated = false;

  for (const key of keys) {
    if (isSensitiveKey(key)) continue;
    if (acceptedEntries >= maxEntries) {
      truncated = true;
      break;
    }

    const childValue = readProperty(value, key);
    if (childValue === undefined) continue;

    let safeValue: SafeScalar;
    if (typeof childValue === "string") {
      const sanitized = sanitizeText(childValue, MAX_CONTEXT_STRING_LENGTH);
      safeValue = sanitized.value;
      if (sanitized.truncated) truncated = true;
    } else if (
      typeof childValue === "number" &&
      Number.isFinite(childValue)
    ) {
      safeValue = childValue;
    } else if (typeof childValue === "boolean") {
      safeValue = childValue;
    } else {
      continue;
    }

    setRecordValue(record, key, safeValue);
    acceptedEntries += 1;
  }

  return {
    truncated,
    value: acceptedEntries > 0 ? record : undefined,
  };
}

function serializeLabels(value: unknown): {
  value?: string[];
  truncated: boolean;
} {
  if (!isArray(value)) return { truncated: false };

  const length = getArrayLength(value);
  if (length === undefined) return { truncated: true };

  const labels: string[] = [];
  const inspectedLength = Math.min(length, MAX_ERROR_LABELS);
  let truncated = length > inspectedLength;

  for (let index = 0; index < inspectedLength; index += 1) {
    const child = readArrayValue(value, index);
    if (child.failed) {
      truncated = true;
      continue;
    }
    if (typeof child.value !== "string") continue;

    const label = sanitizeText(child.value, MAX_LABEL_LENGTH);
    labels.push(label.value);
    if (label.truncated) truncated = true;
  }

  return {
    truncated,
    value: labels.length > 0 || length === 0 ? labels : undefined,
  };
}

function createTruncatedError(name: string, message: string): SerializedError {
  return { name, message, truncated: true };
}

function serializeNonError(value: unknown): SerializedError {
  const message = sanitizeText(
    safeThrownMessage(value),
    MAX_ERROR_MESSAGE_LENGTH,
  );
  const serialized: SerializedError = {
    name: "NonErrorThrow",
    message: message.value,
  };
  if (message.truncated) serialized.truncated = true;
  return serialized;
}

function serializeUnknown(
  value: unknown,
  depth: number,
  state: SerializationState,
): SerializedError {
  if (!isErrorLike(value)) return serializeNonError(value);

  if (state.active.has(value)) {
    return createTruncatedError("CircularError", "[CircularError]");
  }
  state.active.add(value);

  try {
    const nativeError = isNativeError(value);
    const rawName =
      safePrimitiveString(readProperty(value, "name")) ??
      (nativeError ? "Error" : "NonErrorThrow");
    const rawMessage =
      safePrimitiveString(readProperty(value, "message")) ??
      (nativeError ? "" : safeThrownMessage(value));
    const name = sanitizeText(rawName, MAX_ERROR_NAME_LENGTH);
    const message = sanitizeText(rawMessage, MAX_ERROR_MESSAGE_LENGTH);
    const serialized: SerializedError = {
      name: name.value,
      message: message.value,
    };
    if (name.truncated || message.truncated) serialized.truncated = true;

    const stack = safePrimitiveString(readProperty(value, "stack"));
    if (stack !== undefined) {
      const sanitizedStack = sanitizeText(stack, MAX_ERROR_STACK_LENGTH);
      serialized.stack = sanitizedStack.value;
      if (sanitizedStack.truncated) serialized.truncated = true;
    }

    const code = readProperty(value, "code");
    if (typeof code === "string") {
      const sanitizedCode = sanitizeText(code, MAX_ERROR_CODE_LENGTH);
      serialized.code = sanitizedCode.value;
      if (sanitizedCode.truncated) serialized.truncated = true;
    } else if (typeof code === "number" && Number.isFinite(code)) {
      serialized.code = code;
    }

    const codeName = safePrimitiveString(readProperty(value, "codeName"));
    if (codeName !== undefined) {
      const sanitizedCodeName = sanitizeText(codeName, MAX_ERROR_CODE_LENGTH);
      serialized.codeName = sanitizedCodeName.value;
      if (sanitizedCodeName.truncated) serialized.truncated = true;
    }

    const errorLabels = serializeLabels(readProperty(value, "errorLabels"));
    if (errorLabels.value !== undefined) serialized.errorLabels = errorLabels.value;
    if (errorLabels.truncated) serialized.truncated = true;

    const statusCode = readProperty(value, "statusCode");
    if (typeof statusCode === "number" && Number.isFinite(statusCode)) {
      serialized.statusCode = statusCode;
    }

    const errorCode = safePrimitiveString(readProperty(value, "errorCode"));
    if (errorCode !== undefined) {
      const sanitizedErrorCode = sanitizeText(errorCode, MAX_ERROR_CODE_LENGTH);
      serialized.errorCode = sanitizedErrorCode.value;
      if (sanitizedErrorCode.truncated) serialized.truncated = true;
    }

    const context = serializeSafeRecord(
      readProperty(value, "context"),
      MAX_CONTEXT_ENTRIES,
    );
    if (context.value !== undefined) serialized.context = context.value;
    if (context.truncated) serialized.truncated = true;

    const keyPattern = serializeSafeRecord(
      readProperty(value, "keyPattern"),
      MAX_METADATA_ENTRIES,
    );
    if (keyPattern.value !== undefined) serialized.keyPattern = keyPattern.value;
    if (keyPattern.truncated) serialized.truncated = true;

    // Root is depth 0; depth 4 is retained but is not traversed further.
    if (depth >= MAX_ERROR_DEPTH) {
      const cause = readProperty(value, "cause");
      const aggregateError = isAggregateError(value);
      const aggregateErrors = aggregateError
        ? readProperty(value, "errors")
        : undefined;
      const aggregateLength = getArrayLength(aggregateErrors);

      if (
        cause !== undefined ||
        (aggregateLength !== undefined && aggregateLength > 0) ||
        (aggregateError &&
          aggregateErrors !== undefined &&
          aggregateLength === undefined)
      ) {
        serialized.truncated = true;
      }
      return serialized;
    }

    const cause = readProperty(value, "cause");
    if (cause !== undefined) {
      serialized.cause = serializeUnknown(cause, depth + 1, state);
      if (serialized.cause.truncated) serialized.truncated = true;
    }

    if (isAggregateError(value)) {
      const aggregateErrors = readProperty(value, "errors");
      if (isArray(aggregateErrors)) {
        serialized.errors = [];
        const length = getArrayLength(aggregateErrors);
        if (length === undefined) {
          serialized.truncated = true;
        } else {
          const inspectedLength = Math.min(length, MAX_AGGREGATE_ERRORS);
          if (length > inspectedLength) serialized.truncated = true;

          for (let index = 0; index < inspectedLength; index += 1) {
            const childValue = readArrayValue(aggregateErrors, index);
            if (childValue.failed) {
              serialized.errors.push(
                createTruncatedError(
                  "UnserializableAggregateError",
                  "[UnserializableAggregateError]",
                ),
              );
              serialized.truncated = true;
              continue;
            }
            const child = serializeUnknown(childValue.value, depth + 1, state);
            serialized.errors.push(child);
            if (child.truncated) serialized.truncated = true;
          }
        }
      }
    }

    return serialized;
  } finally {
    state.active.delete(value);
  }
}

export function serializeError(error: unknown): SerializedError {
  try {
    return serializeUnknown(error, 0, { active: new WeakSet<object>() });
  } catch {
    return createTruncatedError("SerializationError", "[UnserializableError]");
  }
}
