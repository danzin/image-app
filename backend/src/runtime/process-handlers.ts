import { logNonHttpTerminalError } from "@/runtime/non-http-error-logger";

let handlersRegistered = false;

function scheduleFatalExit(): void {
  setImmediate(() => process.exit(1));
}

export function registerGlobalProcessHandlers(): void {
  if (handlersRegistered) {
    return;
  }

  handlersRegistered = true;

  process.on("uncaughtException", (error: Error) => {
    logNonHttpTerminalError(error, {
      message: "Uncaught exception",
      event: "process.uncaught_exception",
      operation: "uncaught_exception",
    });
    scheduleFatalExit();
  });

  process.on("unhandledRejection", (reason: unknown) => {
    logNonHttpTerminalError(reason, {
      message: "Unhandled promise rejection",
      event: "process.unhandled_rejection",
      operation: "unhandled_rejection",
    });
    scheduleFatalExit();
  });
}
