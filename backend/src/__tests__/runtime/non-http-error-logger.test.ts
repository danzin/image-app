import { expect } from "chai";
import sinon from "sinon";
import { logNonHttpTerminalError } from "@/runtime/non-http-error-logger";
import { errorLogger } from "@/utils/winston";

describe("non-HTTP terminal error logging", () => {
  afterEach(() => sinon.restore());

  it("omits attempt when the caller does not supply one", () => {
    const logError = sinon.stub(errorLogger, "error");

    logNonHttpTerminalError(new Error("failed"), {
      message: "Operation failed",
      event: "operation.failed",
      operation: "operation",
    });

    sinon.assert.calledOnce(logError);
    expect(logError.firstCall.args[0]).not.to.have.property("attempt");
  });

  it("bounds, redacts, or rejects unsafe metadata", () => {
    const logError = sinon.stub(errorLogger, "error");
    const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.signature";

    logNonHttpTerminalError(new Error("password=error-secret"), {
      message: "Bearer message-secret",
      event: "metadata.safety",
      operation: "authorization: Bearer operation-secret",
      worker: `mongodb://alice:worker-secret@db.example/app${"x".repeat(300)}`,
      messageType: "Cookie: session=message-secret",
      messageId: "m".repeat(129),
      operationId: jwt,
      correlationId: "unsafe correlation id",
      traceId: "token=trace-secret",
      signal: "password=signal-secret\nnext",
    });

    const record = logError.firstCall.args[0] as Record<string, unknown>;
    const suppliedStrings = [
      record.message,
      record.operation,
      record.worker,
      record.messageType,
      record.signal,
      (record.error as { message: string }).message,
    ] as string[];

    expect(suppliedStrings.every((value) => value.length <= 256)).to.equal(true);
    expect(suppliedStrings.join(" ")).not.to.contain("secret");
    expect(suppliedStrings.join("")).not.to.contain("\n");
    expect(record.operationId).not.to.equal(jwt);
    expect(record.operationId).to.match(/^[A-Za-z0-9._:-]{1,128}$/);
    expect(record).not.to.have.property("messageId");
    expect(record).not.to.have.property("correlationId");
    expect(record).not.to.have.property("traceId");
  });
});
