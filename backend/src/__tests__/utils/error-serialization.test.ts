import { expect } from "chai";
import { AppError, ErrorCode } from "@/utils/errors";
import { serializeError } from "@/utils/error-serialization";

describe("serializeError", () => {
  it("serializes a native Error without undefined fields", () => {
    const error = new Error("native failure");
    error.name = "NativeError";

    const serialized = serializeError(error);

    expect(serialized).to.deep.equal({
      name: "NativeError",
      message: "native failure",
      stack: error.stack,
    });
  });

  it("preserves AppError metadata and only scalar context values", () => {
    const error = new AppError("DatabaseError", "database failure", 503, {
      errorCode: ErrorCode.DATABASE_ERROR,
      context: {
        operation: "loadUser",
        attempt: 2,
        retriable: true,
        omitted: undefined,
        nested: { value: "not serialized" },
        password: "not serialized",
        "profile.email": "not serialized",
        "user-email": "not serialized",
        API_KEY: "not serialized",
        APIKey: "not serialized",
        "request.body": "not serialized",
        safeField: "preserved",
      },
    });

    const serialized = serializeError(error);

    expect(serialized.statusCode).to.equal(503);
    expect(serialized.errorCode).to.equal(ErrorCode.DATABASE_ERROR);
    expect(serialized.context).to.deep.equal({
      operation: "loadUser",
      attempt: 2,
      retriable: true,
      safeField: "preserved",
    });
    expect(serialized).not.to.have.property("omitted");
  });

  it("preserves safe Mongo-like error metadata and filters unsafe values", () => {
    const error = Object.assign(new Error("duplicate key"), {
      code: 11000,
      codeName: "DuplicateKey",
      errorLabels: ["RetryableWriteError", "TransientTransactionError", 42],
      keyPattern: {
        slug: 1,
        email: 1,
        "profile.email": 1,
        participantHash: 1,
        nested: { value: "not serialized" },
      },
      keyValue: {
        slug: "safe-slug",
        email: "person@example.com",
        phone: "+359000000000",
        accessToken: "secret-token",
        nested: { value: "not serialized" },
        missing: undefined,
      },
    });
    error.name = "MongoServerError";

    const serialized = serializeError(error);

    expect(serialized.name).to.equal("MongoServerError");
    expect(serialized.code).to.equal(11000);
    expect(serialized.codeName).to.equal("DuplicateKey");
    expect(serialized.errorLabels).to.deep.equal([
      "RetryableWriteError",
      "TransientTransactionError",
    ]);
    expect(serialized.keyPattern).to.deep.equal({
      slug: 1,
      participantHash: 1,
    });
    expect(serialized).not.to.have.property("keyValue");
    expect(JSON.stringify(serialized)).not.to.include("safe-slug");
    expect(JSON.stringify(serialized)).not.to.include("person@example.com");
    expect(JSON.stringify(serialized)).not.to.include("+359000000000");
    expect(JSON.stringify(serialized)).not.to.include("secret-token");
  });

  it("recursively serializes nested causes", () => {
    const root = new Error("root", {
      cause: new Error("middle", { cause: new Error("inner") }),
    });

    const serialized = serializeError(root);

    expect(serialized.cause?.message).to.equal("middle");
    expect(serialized.cause?.cause?.message).to.equal("inner");
  });

  it("serializes AggregateError causes and contained non-Error values", () => {
    const aggregate = new AggregateError(
      [new Error("first failure"), "second failure"],
      "multiple failures",
    );
    aggregate.cause = new Error("aggregate cause");

    const serialized = serializeError(aggregate);

    expect(serialized.message).to.equal("multiple failures");
    expect(serialized.cause?.message).to.equal("aggregate cause");
    expect(serialized.errors?.[0].message).to.equal("first failure");
    expect(serialized.errors?.[1]).to.deep.equal({
      name: "NonErrorThrow",
      message: "second failure",
    });
  });

  it("bounds aggregate breadth and serializes shared errors per branch", () => {
    const shared = new Error("shared failure");
    const aggregate = new AggregateError(
      [
        shared,
        shared,
        ...Array.from({ length: 10 }, (_, index) => new Error(`failure ${index}`)),
      ],
      "many failures",
    );

    const serialized = serializeError(aggregate);

    expect(serialized.errors).to.have.length(8);
    expect(serialized.truncated).to.equal(true);
    expect(serialized.errors?.[0].message).to.equal("shared failure");
    expect(serialized.errors?.[1].message).to.equal("shared failure");
    expect(serialized.errors?.[1].name).not.to.equal("CircularError");
  });

  it("bounds sparse label inspection and label length", () => {
    const sparseLabels = new Array(1_000_000) as unknown[];
    sparseLabels[999_999] = "late label";
    const error = new Error("labels");
    (error as Error & { errorLabels: unknown }).errorLabels = sparseLabels;

    const serialized = serializeError(error);

    expect(serialized.errorLabels).to.be.undefined;
    expect(serialized.truncated).to.equal(true);

    const manyLabels = new Error("many labels") as Error & {
      errorLabels: string[];
    };
    manyLabels.errorLabels = Array.from({ length: 9 }, (_, index) =>
      `label-${index}`,
    );

    const manyLabelsResult = serializeError(manyLabels);
    expect(manyLabelsResult.errorLabels).to.have.length(8);
    expect(manyLabelsResult.truncated).to.equal(true);
  });

  it("redacts and bounds selected string values", () => {
    const longValue = "x".repeat(40_000);
    const error = new Error("Authorization: Bearer secret-token");
    error.stack = `Cookie: session=secret-cookie\n${longValue}`;
    Object.assign(error, {
      code: `password=secret-code ${longValue}`,
      codeName: longValue,
      errorCode: `refreshToken=secret-refresh ${longValue}`,
      errorLabels: [`Bearer secret-label ${longValue}`],
      context: {
        details: `Bearer secret-context ${longValue}`,
      },
    });

    const serialized = serializeError(error);

    expect(serialized.message).not.to.include("secret-token");
    expect(serialized.message.length).to.be.at.most(4_096);
    expect(serialized.stack).not.to.include("secret-cookie");
    expect(serialized.stack?.length).to.be.at.most(32_768);
    expect(serialized.code).not.to.include("secret-code");
    expect(String(serialized.codeName)).to.have.length.at.most(256);
    expect(serialized.errorCode).not.to.include("secret-refresh");
    expect(serialized.errorLabels?.[0]).not.to.include("secret-label");
    expect(serialized.context?.details).not.to.include("secret-context");
    expect(serialized.truncated).to.equal(true);
  });

  it("marks circular causes and depth truncation without throwing", () => {
    const circular = new Error("circular");
    circular.cause = circular;

    const circularResult = serializeError(circular);
    expect(circularResult.truncated).to.equal(true);
    expect(circularResult.cause).to.deep.equal({
      name: "CircularError",
      message: "[CircularError]",
      truncated: true,
    });

    let deepest = new Error("depth 6");
    for (let depth = 5; depth >= 0; depth -= 1) {
      deepest = new Error(`depth ${depth}`, { cause: deepest });
    }

    const depthResult = serializeError(deepest);
    let current = depthResult;
    for (let depth = 0; depth < 4; depth += 1) {
      expect(current.cause).to.exist;
      current = current.cause as typeof current;
    }
    expect(current.message).to.equal("depth 4");
    expect(current.truncated).to.equal(true);
    expect(current.cause).to.be.undefined;
  });

  it("does not mark a complete maximum-depth chain as truncated", () => {
    let deepest = new Error("depth 4");
    for (let depth = 3; depth >= 0; depth -= 1) {
      deepest = new Error(`depth ${depth}`, { cause: deepest });
    }

    const serialized = serializeError(deepest);
    let current = serialized;
    for (let depth = 0; depth < 4; depth += 1) {
      expect(current).not.to.have.property("truncated");
      current = current.cause as typeof current;
    }

    expect(current).not.to.have.property("truncated");
    expect(current.cause).to.be.undefined;
  });

  it("distinguishes unreadable aggregate elements from undefined values", () => {
    const unreadableErrors: unknown[] = [];
    Object.defineProperty(unreadableErrors, 0, {
      enumerable: true,
      get() {
        throw new Error("aggregate element blocked");
      },
    });
    const aggregate = new AggregateError([], "unreadable aggregate");
    Object.defineProperty(aggregate, "errors", {
      configurable: true,
      value: unreadableErrors,
      writable: true,
    });

    const serialized = serializeError(aggregate);

    expect(serialized.errors).to.deep.equal([
      {
        name: "UnserializableAggregateError",
        message: "[UnserializableAggregateError]",
        truncated: true,
      },
    ]);
    expect(serialized.truncated).to.equal(true);

    const explicitUndefined = serializeError(new AggregateError([undefined], "undefined"));
    expect(explicitUndefined.errors?.[0]).to.deep.equal({
      name: "NonErrorThrow",
      message: "undefined",
    });
  });

  it("does not throw when a proxy rejects inspection", () => {
    const hostile = new Proxy(new Error("hidden"), {
      get() {
        throw new Error("get blocked");
      },
      getPrototypeOf() {
        throw new Error("prototype blocked");
      },
      ownKeys() {
        throw new Error("keys blocked");
      },
    });

    expect(() => serializeError(hostile)).not.to.throw();
    expect(serializeError(hostile).name).to.equal("NonErrorThrow");
  });

  it("serializes non-Error thrown values without enumerating arbitrary fields", () => {
    expect(serializeError("string failure")).to.deep.equal({
      name: "NonErrorThrow",
      message: "string failure",
    });
    expect(serializeError({ message: "object failure", token: "secret" })).to.deep.equal({
      name: "NonErrorThrow",
      message: "object failure",
    });
    expect(serializeError(undefined)).to.deep.equal({
      name: "NonErrorThrow",
      message: "undefined",
    });
  });
});
