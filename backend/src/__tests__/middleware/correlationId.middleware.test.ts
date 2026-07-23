import { expect } from "chai";
import sinon from "sinon";
import { correlationIdMiddleware } from "@/middleware/correlationId.middleware";
import {
  addRequestContextBreadcrumb,
  getCorrelationId,
  getRequestContext,
  setRequestContextUserId,
} from "@/runtime/request-context";

describe("correlationIdMiddleware", () => {
  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  it("reuses an incoming x-request-id header", (done) => {
    const req = {
      method: "GET",
      path: "/health",
      get: sinon.stub().callsFake((header: string) => {
        const headers: Record<string, string> = {
          "x-request-id": "request-abc",
          "x-client-request-id": "client-request-abc",
          "x-client-boot-id": "client-boot-abc",
          "x-previous-client-request-id": "previous-client-request-abc",
          "x-caused-by-client-request-id": "cause-client-request-abc",
        };
        return headers[header];
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
      expect(getRequestContext()).to.deep.include({
        correlationId: "request-abc",
        method: "GET",
        requestPath: "/health",
        clientRequestId: "client-request-abc",
        clientBootId: "client-boot-abc",
        previousClientRequestId: "previous-client-request-abc",
        causedByClientRequestId: "cause-client-request-abc",
        breadcrumbs: [],
      });
      expect(getRequestContext()?.requestStartTime).to.be.a("bigint");
      done();
    });
  });

  it("creates a new correlation id when the request has none", (done) => {
    const req = {
      method: "GET",
      path: "/health",
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
      method: "POST",
      path: "/api/posts",
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
      expect(getRequestContext()).to.deep.include({
        method: "POST",
        requestPath: "/api/posts",
        causedByClientRequestId: "safe-causation-id",
        breadcrumbs: [],
      });
      done();
    });
  });

  it("bounds the concrete request path retained in context", (done) => {
    const req = {
      method: "GET",
      path: `/${"x".repeat(2_100)}`,
      get: sinon.stub().returns(undefined),
    } as any;
    const res = { setHeader: sinon.stub() } as any;

    correlationIdMiddleware(req, res, () => {
      expect(getRequestContext()?.requestPath).to.have.length(2_048);
      done();
    });
  });

  it("keeps overlapping request contexts isolated through awaited work", async () => {
    const runRequest = (
      correlationId: string,
      clientRequestId: string,
      delayMs: number,
    ): Promise<ReturnType<typeof getRequestContext>> =>
      new Promise((resolve, reject) => {
        const req = {
          method: "GET",
          path: `/api/${correlationId}`,
          get: sinon.stub().callsFake((header: string) => {
            const headers: Record<string, string> = {
              "x-request-id": correlationId,
              "x-client-request-id": clientRequestId,
            };
            return headers[header];
          }),
        } as any;
        const res = { setHeader: sinon.stub() } as any;

        correlationIdMiddleware(req, res, () => {
          void (async () => {
            try {
              setRequestContextUserId(`user-${correlationId}`);
              addRequestContextBreadcrumb("request.marker", {
                request: correlationId,
              });
              const initialContext = getRequestContext();
              await new Promise<void>((done) => setTimeout(done, delayMs));
              const resumedContext = getRequestContext();

              expect(resumedContext).to.equal(initialContext);
              expect(resumedContext).to.deep.include({
                correlationId,
                clientRequestId,
                method: "GET",
                requestPath: `/api/${correlationId}`,
                userId: `user-${correlationId}`,
              });
              expect(resumedContext?.breadcrumbs).to.have.length(1);
              expect(resumedContext?.breadcrumbs[0]).to.deep.include({
                event: "request.marker",
                data: { request: correlationId },
              });
              resolve(resumedContext);
            } catch (error) {
              reject(error);
            }
          })();
        });
      });

    const [firstContext, secondContext] = await Promise.all([
      runRequest("request-one", "client-one", 20),
      runRequest("request-two", "client-two", 5),
    ]);

    expect(firstContext?.userId).to.equal("user-request-one");
    expect(secondContext?.userId).to.equal("user-request-two");
    expect(firstContext?.breadcrumbs[0]?.data?.request).to.equal("request-one");
    expect(secondContext?.breadcrumbs[0]?.data?.request).to.equal("request-two");
    expect(firstContext?.userId).not.to.equal(secondContext?.userId);
    expect(firstContext?.breadcrumbs[0]?.data?.request).not.to.equal(
      secondContext?.breadcrumbs[0]?.data?.request,
    );
  });
});
