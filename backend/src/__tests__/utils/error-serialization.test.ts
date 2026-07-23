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
      },
    });

    const serialized = serializeError(error);

    expect(serialized.statusCode).to.equal(503);
    expect(serialized.errorCode).to.equal(ErrorCode.DATABASE_ERROR);
    expect(serialized.context).to.deep.equal({
      operation: "loadUser",
      attempt: 2,
      retriable: true,
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
        nested: { value: "not serialized" },
      },
      keyValue: {
        slug: "safe-slug",
        email: "person@example.com",
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
    expect(serialized.keyPattern).to.deep.equal({ slug: 1 });
    expect(serialized.keyValue).to.deep.equal({ slug: "safe-slug" });
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
    expect(current.truncated).to.equal(true);
    expect(current.cause).to.be.undefined;
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
