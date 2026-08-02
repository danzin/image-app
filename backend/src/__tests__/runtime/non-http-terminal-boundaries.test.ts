import { expect } from "chai";
import sinon from "sinon";
import { runWorkerEntrypoint } from "@/runtime/backend-runtime";
import { registerGlobalProcessHandlers } from "@/runtime/process-handlers";
import { errorLogger } from "@/utils/winston";
import type { IWorker } from "@/workers/base/IWorker";

type ProcessHandler = (...args: unknown[]) => void;

function captureProcessHandlers(): Map<string, ProcessHandler> {
  const handlers = new Map<string, ProcessHandler>();
  sinon.stub(process, "on").callsFake(
    ((event: string | symbol, listener: ProcessHandler) => {
      handlers.set(String(event), listener);
      return process;
    }) as typeof process.on,
  );
  return handlers;
}

function createWorker(
  stop: () => Promise<void> = async () => undefined,
): IWorker {
  return { start: () => undefined, stop };
}

describe("non-HTTP terminal boundaries", () => {
  afterEach(() => sinon.restore());

  it("normalizes process and worker terminal failures", async () => {
    const handlers = captureProcessHandlers();
    const logError = sinon.stub(errorLogger, "error");
    const exit = sinon.stub(process, "exit");

    registerGlobalProcessHandlers();
    handlers.get("uncaughtException")?.(new Error("uncaught failure"));
    handlers.get("unhandledRejection")?.(new Error("rejected failure"));
    await new Promise((resolve) => setImmediate(resolve));

    const records = logError.args.map(([record]) => record) as Array<{
      event: string;
      operation: string;
      errorId: string;
      error: { message: string };
    }>;
    expect(
      records.map(({ event, operation, error }) => [
        event,
        operation,
        error.message,
      ]),
    ).to.deep.equal([
      ["process.uncaught_exception", "uncaught_exception", "uncaught failure"],
      ["process.unhandled_rejection", "unhandled_rejection", "rejected failure"],
    ]);
    expect(records.every(({ errorId }) => Boolean(errorId))).to.equal(true);
    sinon.assert.calledTwice(exit);
    logError.resetHistory();
    exit.resetHistory();

    await runWorkerEntrypoint({
      workerName: "Test worker",
      resolveWorker: () => createWorker(),
      startWorker: async () => Promise.reject(new Error("start failed")),
      initializeRuntime: async () => undefined,
    });

    sinon.assert.calledOnce(logError);
    expect(logError.firstCall.args[0]).to.include({
      event: "worker.start_failed",
      worker: "Test worker",
      operation: "startup",
    });
    expect(logError.firstCall.args[0]).to.have.nested.property(
      "error.message",
      "start failed",
    );
    sinon.assert.calledOnceWithExactly(exit, 1);
    logError.resetHistory();
    exit.resetHistory();

    await runWorkerEntrypoint({
      workerName: "Test worker",
      resolveWorker: () =>
        createWorker(async () => Promise.reject(new Error("shutdown failed"))),
      startWorker: async () => undefined,
      initializeRuntime: async () => undefined,
    });
    sinon.assert.notCalled(logError);
    expect(handlers.has("SIGTERM")).to.equal(true);

    handlers.get("SIGTERM")?.();
    await new Promise((resolve) => setImmediate(resolve));

    sinon.assert.calledOnce(logError);
    expect(logError.firstCall.args[0]).to.include({
      event: "worker.shutdown.failed",
      worker: "Test worker",
      operation: "shutdown",
      signal: "SIGTERM",
    });
    sinon.assert.calledOnceWithExactly(exit, 1);
  });
});
