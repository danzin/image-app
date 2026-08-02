import "reflect-metadata";
import "@/runtime/bootstrap-env";

import { container } from "tsyringe";
import { IpMonitorWorker } from "../workers/_impl/ip-monitor.worker.impl";
import { runWorkerEntrypoint } from "@/runtime/backend-runtime";
import { isRequestLogPersistenceEnabled } from "@/config/requestLogConfig";
import { logger } from "@/utils/winston";

if (!isRequestLogPersistenceEnabled()) {
  logger.info(
    "IP monitor worker entrypoint disabled because request-log persistence is disabled",
    { event: "worker.ip_monitor.disabled" },
  );
} else {
  void runWorkerEntrypoint({
    workerName: "IP monitor",
    resolveWorker: () => container.resolve(IpMonitorWorker),
    startWorker: async (worker) => {
      await worker.start();
    },
  });
}
