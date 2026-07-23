import { expect } from "chai";
import sinon from "sinon";
import { correlationIdMiddleware } from "@/middleware/correlationId.middleware";
import { getCorrelationId } from "@/runtime/request-context";

describe("correlationIdMiddleware", () => {
  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  it("reuses an incoming x-request-id header", (done) => {
    const req = {
      get: sinon.stub().callsFake((header: string) => {
        if (header === "x-request-id") {
          return "request-abc";
        }

        return undefined;
      }),
    } as any;
    const res = {
      setHeader: sinon.stub(),
    } as any;

    correlationIdMiddleware(req, res, () => {
      expect(req.correlationId).to.equal("request-abc");
      expect(res.setHeader.calledOnceWithExactly("X-Request-ID", "request-abc"))
        .to.be.true;
      expect(getCorrelationId()).to.equal("request-abc");
      done();
    });
  });

  it("creates a new correlation id when the request has none", (done) => {
    const req = {
      get: sinon.stub().returns(undefined),
    } as any;
    const res = {
      setHeader: sinon.stub(),
    } as any;

    correlationIdMiddleware(req, res, () => {
      expect(req.correlationId).to.be.a("string");
      expect(req.correlationId).to.match(uuidPattern);
      expect(
        res.setHeader.calledOnceWithExactly("X-Request-ID", req.correlationId),
      ).to.be.true;
      expect(getCorrelationId()).to.equal(req.correlationId);
      done();
    });
  });

  it("rejects unsafe client-provided identifiers before they reach request metadata", (done) => {
    const req = {
      get: sinon.stub().callsFake((header: string) => {
        const headers: Record<string, string> = {
          "x-request-id": "Bearer secret-token",
          "x-client-request-id": "password=hunter2",
          "x-client-boot-id": "x".repeat(129),
          "x-previous-client-request-id": "contains space",
          "x-caused-by-client-request-id": "safe-causation-id",
          "x-axios-retry": "banana",
        };
        return headers[header];
      }),
    } as any;
    const res = { setHeader: sinon.stub() } as any;

    correlationIdMiddleware(req, res, () => {
      expect(req.correlationId).to.match(uuidPattern);
      expect(req.clientRequestId).to.be.undefined;
      expect(req.clientBootId).to.be.undefined;
      expect(req.previousClientRequestId).to.be.undefined;
      expect(req.causedByClientRequestId).to.equal("safe-causation-id");
      expect(req.axiosRetry).to.be.undefined;
      done();
    });
  });
});
