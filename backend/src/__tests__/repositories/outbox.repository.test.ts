import "reflect-metadata";
import { expect } from "chai";
import { beforeEach, describe, it } from "mocha";
import sinon from "sinon";
import {
  MAX_OUTBOX_RETRIES,
  OutboxRepository,
} from "@/repositories/outbox.repository";

describe("OutboxRepository retry state", () => {
  const eventId = "507f1f77bcf86cd799439011";
  let model: {
    findOneAndUpdate: sinon.SinonStub;
    updateOne: sinon.SinonStub;
  };
  let repository: OutboxRepository;

  beforeEach(() => {
    model = {
      findOneAndUpdate: sinon.stub(),
      updateOne: sinon.stub(),
    };
    repository = new OutboxRepository(model as any);
  });

  it("only claims delayed retries after nextAttemptAt becomes eligible", async () => {
    model.findOneAndUpdate.returns({
      exec: sinon.stub().resolves(null),
    });
    const before = Date.now();

    await repository.claimPendingEvents(1, "worker-1", 60_000);

    const filter = model.findOneAndUpdate.firstCall.args[0];
    const eligibility = filter.$and[0].$or;
    expect(eligibility[0]).to.deep.equal({
      nextAttemptAt: { $exists: false },
    });
    expect(eligibility[1].nextAttemptAt.$lte).to.be.instanceOf(Date);
    expect(eligibility[1].nextAttemptAt.$lte.getTime()).to.be.at.least(before);
    expect(filter.exhaustedAt).to.deep.equal({ $exists: false });
    expect(filter.retries).to.deep.equal({ $lt: MAX_OUTBOX_RETRIES });
  });

  it("requeues a legacy exhausted event without exhaustedAt", async () => {
    useReplayRecord({
      processed: false,
      processing: false,
      retries: MAX_OUTBOX_RETRIES,
    });

    expect(await repository.requeueExhaustedEvent(eventId)).to.equal(true);
  });

  it("requeues a modern exhausted event with exhaustedAt", async () => {
    useReplayRecord({
      processed: false,
      processing: false,
      retries: 1,
      exhaustedAt: new Date(),
    });

    expect(await repository.requeueExhaustedEvent(eventId)).to.equal(true);
  });

  it("rejects a processed exhausted event", async () => {
    useReplayRecord({
      processed: true,
      processing: false,
      retries: MAX_OUTBOX_RETRIES,
    });

    expect(await repository.requeueExhaustedEvent(eventId)).to.equal(false);
  });

  it("rejects a non-exhausted event", async () => {
    useReplayRecord({
      processed: false,
      processing: false,
      retries: MAX_OUTBOX_RETRIES - 1,
    });

    expect(await repository.requeueExhaustedEvent(eventId)).to.equal(false);
  });

  it("rejects an exhausted event that is actively processing", async () => {
    useReplayRecord({
      processed: false,
      processing: true,
      retries: MAX_OUTBOX_RETRIES,
    });

    expect(await repository.requeueExhaustedEvent(eventId)).to.equal(false);
  });

  it("preserves handler checkpoints and immutable event data", async () => {
    useReplayRecord({
      processed: false,
      processing: false,
      retries: MAX_OUTBOX_RETRIES,
      exhaustedAt: new Date(),
    });

    expect(await repository.requeueExhaustedEvent(eventId)).to.equal(true);

    const [filter, update] = model.updateOne.firstCall.args;
    expect(filter).to.deep.equal({
      _id: eventId,
      processed: false,
      processing: { $ne: true },
      $or: [
        { retries: { $gte: MAX_OUTBOX_RETRIES } },
        { exhaustedAt: { $exists: true } },
      ],
    });
    expect(update.$set).to.deep.equal({
      retries: 0,
      processing: false,
    });
    for (const preservedField of [
      "processedHandlers",
      "payload",
      "eventType",
      "traceId",
      "correlationId",
      "createdAt",
    ]) {
      expect(update.$set).to.not.have.property(preservedField);
      expect(update.$unset).to.not.have.property(preservedField);
    }
  });

  function useReplayRecord(record: {
    processed: boolean;
    processing: boolean;
    retries: number;
    exhaustedAt?: Date;
  }): void {
    model.updateOne.callsFake((filter) => ({
      exec: sinon.stub().resolves({
        modifiedCount: matchesReplayFilter(record, filter) ? 1 : 0,
      }),
    }));
  }
});

function matchesReplayFilter(
  record: {
    processed: boolean;
    processing: boolean;
    retries: number;
    exhaustedAt?: Date;
  },
  filter: {
    processed: boolean;
    processing: { $ne: boolean };
    $or: Array<
      | { retries: { $gte: number } }
      | { exhaustedAt: { $exists: boolean } }
    >;
  },
): boolean {
  const retryCondition = filter.$or.find(
    (condition) => "retries" in condition,
  );
  const exhaustedAtCondition = filter.$or.find(
    (condition) => "exhaustedAt" in condition,
  );

  return (
    record.processed === filter.processed &&
    record.processing !== filter.processing.$ne &&
    retryCondition !== undefined &&
    "retries" in retryCondition &&
    exhaustedAtCondition !== undefined &&
    "exhaustedAt" in exhaustedAtCondition &&
    (record.retries >= retryCondition.retries.$gte ||
      ("exhaustedAt" in record) ===
        exhaustedAtCondition.exhaustedAt.$exists)
  );
}
