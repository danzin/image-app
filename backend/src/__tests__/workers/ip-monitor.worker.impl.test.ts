import "reflect-metadata";
import { expect } from "chai";
import { afterEach, describe, it } from "mocha";
import sinon from "sinon";
import { RequestLogModel } from "@/models/requestLog.model";
import { IpMonitorWorker } from "@/workers/_impl/ip-monitor.worker.impl";
import { logger } from "@/utils/winston";

describe("IpMonitorWorker", () => {
  const originalPersistenceSetting =
    process.env.REQUEST_LOG_PERSISTENCE_ENABLED;

  afterEach(() => {
    sinon.restore();
    if (originalPersistenceSetting === undefined) {
      delete process.env.REQUEST_LOG_PERSISTENCE_ENABLED;
    } else {
      process.env.REQUEST_LOG_PERSISTENCE_ENABLED =
        originalPersistenceSetting;
    }
  });

  it("does not start when request-log persistence is disabled", () => {
    process.env.REQUEST_LOG_PERSISTENCE_ENABLED = "false";
    const aggregate = sinon.stub(RequestLogModel, "aggregate");
    const info = sinon.stub(logger, "info") as sinon.SinonStub;
    const worker = new IpMonitorWorker({ dispatch: sinon.stub() } as any);

    worker.start();

    expect(aggregate.called).to.equal(false);
    expect(
      info.calledWithMatch(
        "[ip-monitor] Worker disabled because request-log persistence is disabled",
        { event: "worker.ip_monitor.disabled" },
      ),
    ).to.equal(true);
  });
});
