import "reflect-metadata";
import { expect } from "chai";
import sinon from "sinon";
import { TrendingStreamConsumer } from "@/workers/trending/trending-stream.consumer";
import type {
  ITrendingStreamStore,
  TrendingStreamClient,
  TrendingStreamConfig,
} from "@/workers/trending/trending.ports";

const STREAM_CONFIG: TrendingStreamConfig = {
  stream: "stream:interactions",
  group: "trendingGroup",
  consumer: "trending-test",
  readCount: 100,
  reclaimMinIdleMs: 60_000,
};

function createStreamStore(): sinon.SinonStubbedInstance<ITrendingStreamStore> {
  return {
    waitForConnection: sinon.stub(),
    ensureConsumerGroup: sinon.stub(),
    createClient: sinon.stub(),
    closeClient: sinon.stub(),
    readGroup: sinon.stub(),
    acknowledge: sinon.stub(),
    pendingRange: sinon.stub(),
    claim: sinon.stub(),
  };
}

describe("trending stream consumer", () => {
  afterEach(() => {
    sinon.restore();
  });

  it("normalizes stream reads and forwards acknowledgements", async () => {
    const store = createStreamStore();
    const client = { isOpen: true, quit: sinon.stub() };
    store.readGroup.resolves([
      {
        messages: [
          {
            id: "1-0",
            message: { postId: "post-1" },
          },
        ],
      },
    ]);
    store.acknowledge.resolves();
    const consumer = new TrendingStreamConsumer(store);

    expect(
      await consumer.read(
        client as unknown as TrendingStreamClient,
        STREAM_CONFIG,
      ),
    ).to.deep.equal([
      { id: "1-0", fields: { postId: "post-1" } },
    ]);

    await consumer.acknowledge(STREAM_CONFIG, ["1-0"]);
    sinon.assert.calledOnceWithExactly(
      store.acknowledge,
      "stream:interactions",
      "trendingGroup",
      ["1-0"],
    );
  });

  it("filters pending entries before claiming their messages", async () => {
    const store = createStreamStore();
    store.pendingRange.resolves([
      { id: "1-0", millisecondsSinceLastDelivery: 60_000 },
      { id: "2-0", millisecondsSinceLastDelivery: 59_999 },
    ]);
    store.claim.resolves([
      null,
      { id: "1-0", message: { postId: "post-1" } },
    ]);
    const consumer = new TrendingStreamConsumer(store);

    const messageIds = await consumer.findReclaimableMessageIds(
      STREAM_CONFIG,
      1000,
    );
    expect(messageIds).to.deep.equal(["1-0"]);
    expect(await consumer.claim(STREAM_CONFIG, messageIds)).to.deep.equal([
      { id: "1-0", fields: { postId: "post-1" } },
    ]);
  });

  it("rejects malformed stream replies at the Redis boundary", async () => {
    const store = createStreamStore();
    store.readGroup.resolves([{ messages: null }]);
    const consumer = new TrendingStreamConsumer(store);
    const client = { isOpen: true, quit: sinon.stub() };

    let failure: unknown;
    try {
      await consumer.read(
        client as unknown as TrendingStreamClient,
        STREAM_CONFIG,
      );
    } catch (error) {
      failure = error;
    }

    expect(failure).to.be.instanceOf(TypeError);
    expect((failure as Error).message).to.equal(
      "Malformed Redis stream response",
    );
  });
});
