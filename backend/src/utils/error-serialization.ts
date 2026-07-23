const MAX_ERROR_DEPTH = 4;
const MAX_CONTEXT_ENTRIES = 16;
const MAX_METADATA_ENTRIES = 16;
const SENSITIVE_KEY_PATTERN =
  /(?:^|_)(?:password|passphrase|token|secret|authorization|cookie|set_cookie|api_key|jwt|bearer|credential|private_key|encryption_key|email|username|handle|session|refresh|request_body|response_body|raw_body|query|filter|update|document|errinfo|origin|referrer|user_agent|ip|ip_address)(?:$|_)/i;

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
  keyValue?: SafeRecord;
  cause?: SerializedError;
  errors?: SerializedError[];
  truncated?: boolean;
};

type SerializationState = {
  seen: WeakSet<object>;
};

type SafeRecordResult = {
  value?: SafeRecord;
  truncated: boolean;
};

function isObjectLike(value: unknown): value is object {
  return (
    (typeof value === "object" && value !== null) || typeof value === "function"
  );
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

function isErrorLike(value: unknown): value is object {
  if (!isObjectLike(value)) return false;

  try {
    if (value instanceof Error) return true;
  } catch {
    // Continue with the structural check for cross-realm or unusual errors.
  }

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
    Array.isArray(readProperty(value, "errors"))
  );
}

function setRecordValue(record: SafeRecord, key: string, value: SafeScalar): void {
  Object.defineProperty(record, key, {
    configurable: true,
    enumerable: true,
    value,
    writable: true,
  });
}

function isSensitiveKey(key: string): boolean {
  const normalized = key.replace(/[A-Z]/g, (character) => `_${character}`);
  return SENSITIVE_KEY_PATTERN.test(normalized);
}

function serializeSafeRecord(
  value: unknown,
  maxEntries: number,
): SafeRecordResult {
  if (!isObjectLike(value) || Array.isArray(value)) {
    return { truncated: false };
  }

  let keys: string[];
  try {
    keys = Object.keys(value);
  } catch {
    return { truncated: true };
  }

  const record: SafeRecord = {};
  let truncated = false;

  for (const key of keys) {
    if (isSensitiveKey(key)) continue;
    if (Object.keys(record).length >= maxEntries) {
      truncated = true;
      break;
    }

    const childValue = readProperty(value, key);
    if (childValue === undefined) continue;
    if (
      typeof childValue !== "string" &&
      typeof childValue !== "number" &&
      typeof childValue !== "boolean"
    ) {
      continue;
    }
    if (typeof childValue === "number" && !Number.isFinite(childValue)) {
      continue;
    }

    setRecordValue(record, key, childValue);
  }

  return {
    truncated,
    value: Object.keys(record).length > 0 ? record : undefined,
  };
}

function serializeLabels(value: unknown): {
  value?: string[];
  truncated: boolean;
} {
  if (!Array.isArray(value)) return { truncated: false };

  const labels: string[] = [];
  let truncated = false;
  let length = 0;
  try {
    length = value.length;
    for (let index = 0; index < length; index += 1) {
      if (labels.length >= 8) {
        truncated = true;
        break;
      }
      const label = value[index];
      if (typeof label === "string") labels.push(label);
    }
  } catch {
    return {
      truncated: true,
      value: labels.length > 0 ? labels : undefined,
    };
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
  return {
    name: "NonErrorThrow",
    message: safeThrownMessage(value),
  };
}

function serializeUnknown(
  value: unknown,
  depth: number,
  state: SerializationState,
): SerializedError {
  if (!isErrorLike(value)) return serializeNonError(value);

  if (state.seen.has(value)) {
    return createTruncatedError("CircularError", "[CircularError]");
  }
  state.seen.add(value);

  const nativeError = value instanceof Error;
  const name = safePrimitiveString(readProperty(value, "name"));
  const message = safePrimitiveString(readProperty(value, "message"));
  const serialized: SerializedError = {
    name: name ?? (nativeError ? "Error" : "NonErrorThrow"),
    message: message ?? (nativeError ? "" : safeThrownMessage(value)),
  };

  const stack = safePrimitiveString(readProperty(value, "stack"));
  if (stack !== undefined) serialized.stack = stack;

  const code = readProperty(value, "code");
  if (
    typeof code === "string" ||
    (typeof code === "number" && Number.isFinite(code))
  ) {
    serialized.code = code;
  }

  const codeName = safePrimitiveString(readProperty(value, "codeName"));
  if (codeName !== undefined) serialized.codeName = codeName;

  const errorLabels = serializeLabels(readProperty(value, "errorLabels"));
  if (errorLabels.value !== undefined) serialized.errorLabels = errorLabels.value;
  if (errorLabels.truncated) serialized.truncated = true;

  const statusCode = readProperty(value, "statusCode");
  if (typeof statusCode === "number" && Number.isFinite(statusCode)) {
    serialized.statusCode = statusCode;
  }

  const errorCode = safePrimitiveString(readProperty(value, "errorCode"));
  if (errorCode !== undefined) serialized.errorCode = errorCode;

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

  const keyValue = serializeSafeRecord(
    readProperty(value, "keyValue"),
    MAX_METADATA_ENTRIES,
  );
  if (keyValue.value !== undefined) serialized.keyValue = keyValue.value;
  if (keyValue.truncated) serialized.truncated = true;

  if (depth >= MAX_ERROR_DEPTH) {
    serialized.truncated = true;
    return serialized;
  }

  const cause = readProperty(value, "cause");
  if (cause !== undefined) {
    serialized.cause = serializeUnknown(cause, depth + 1, state);
    if (serialized.cause.truncated) serialized.truncated = true;
  }

  if (isAggregateError(value)) {
    const aggregateErrors = readProperty(value, "errors");
    if (Array.isArray(aggregateErrors)) {
      serialized.errors = [];
      try {
        for (let index = 0; index < aggregateErrors.length; index += 1) {
          const child = serializeUnknown(aggregateErrors[index], depth + 1, state);
          serialized.errors.push(child);
          if (child.truncated) serialized.truncated = true;
        }
      } catch {
        serialized.truncated = true;
      }
    }
  }

  return serialized;
}

export function serializeError(error: unknown): SerializedError {
  try {
    return serializeUnknown(error, 0, { seen: new WeakSet<object>() });
  } catch {
    return createTruncatedError("SerializationError", "[UnserializableError]");
  }
}
