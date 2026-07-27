import { expect } from "chai";
import sinon from "sinon";
import {
  addRequestContextBreadcrumb,
  getRequestContext,
} from "@/runtime/request-context";
import { errorLogger } from "@/utils/winston";
import { BasePollingWorker } from "@/workers/base/BasePollingWorker";

class FailingWorker extends BasePollingWorker {
  requestStartTime: bigint | undefined;

  constructor() {
    super("FailingWorker", 1000);
  }

  protected async tick(): Promise<void> {
    this.requestStartTime = getRequestContext()?.requestStartTime;
    addRequestContextBreadcrumb("worker.polling.tick.entered");
    throw new Error("tick failed");
  }

  async executeForTest(): Promise<void> {
    await (this as any).executeTick();
  }
}

describe("BasePollingWorker", () => {
  afterEach(() => sinon.restore());

  it("emits one terminal log with ordered, timed breadcrumbs", async () => {
    const error = sinon.stub(errorLogger, "error");
    const worker = new FailingWorker();

    await worker.executeForTest();

    sinon.assert.calledOnce(error);
    const [record] = error.firstCall.args as unknown as [
      {
      event: string;
      operationId: string;
      errorId: string;
      breadcrumbs: Array<{ event: string; offsetMs?: number }>;
      },
    ];
    expect(record.event).to.equal("worker.polling.tick.failed");
    expect(record.operationId).to.be.a("string").and.not.be.empty;
    expect(record.errorId).to.be.a("string").and.not.be.empty;
    expect(record).not.to.have.property("attempt");
    expect(worker.requestStartTime).to.be.a("bigint");
    expect(record.breadcrumbs.map(({ event }) => event)).to.deep.equal([
      "worker.polling.tick.entered",
      "worker.polling.tick.failed",
    ]);
    expect(record.breadcrumbs[0]?.offsetMs).to.be.a("number");
    expect(record.breadcrumbs[1]?.offsetMs).to.be.at.least(
      record.breadcrumbs[0]?.offsetMs ?? 0,
    );
  });
});
