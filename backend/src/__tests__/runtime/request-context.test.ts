import { expect } from "chai";
import {
  addRequestContextBreadcrumb,
  getRequestContext,
  runWithRequestContext,
  setRequestContextUserId,
} from "@/runtime/request-context";

describe("request context", () => {
  it("bounds breadcrumbs and allows authentication to enrich the active context", () => {
    runWithRequestContext(
      {
        correlationId: "request-123",
        requestStartTime: process.hrtime.bigint(),
      },
      () => {
        setRequestContextUserId("user-123");

        for (let index = 0; index < 21; index += 1) {
          addRequestContextBreadcrumb(`event.${index}`, {
            first: index,
            second: true,
            third: "value",
            fourth: 4,
            fifth: 5,
            sixth: 6,
            seventh: 7,
            eighth: 8,
            ninth: 9,
          });
        }

        const context = getRequestContext();
        expect(context?.userId).to.equal("user-123");
        expect(context?.breadcrumbs).to.have.length(20);
        expect(context?.breadcrumbs[0]?.event).to.equal("event.1");
        expect(context?.breadcrumbs[0]?.offsetMs).to.be.a("number");
        expect(context?.breadcrumbs[19]?.event).to.equal("event.20");
        expect(context?.breadcrumbs[0]?.data).to.deep.equal({
          first: 1,
          second: true,
          third: "value",
          fourth: 4,
          fifth: 5,
          sixth: 6,
          seventh: 7,
          eighth: 8,
        });
      },
    );
  });

  it("sanitizes breadcrumb event names and data at runtime", () => {
    runWithRequestContext({ correlationId: "request-123" }, () => {
      const oversizedKey = "k".repeat(65);
      addRequestContextBreadcrumb("  request.marker  ", {
        operation: "x".repeat(513),
        [oversizedKey]: true,
        password: "not-allowed",
        authorization: "not-allowed",
        clientIp: "127.0.0.1",
        userId: "user-123",
        nested: { unsafe: true } as never,
        nan: Number.NaN,
        infinity: Number.POSITIVE_INFINITY,
      });
      addRequestContextBreadcrumb(" ");
      addRequestContextBreadcrumb("x".repeat(129));

      const breadcrumbs = getRequestContext()?.breadcrumbs;
      expect(breadcrumbs).to.have.length(1);
      expect(breadcrumbs?.[0]).to.deep.include({
        event: "request.marker",
      });
      expect(breadcrumbs?.[0]?.data).to.deep.include({
        operation: "x".repeat(512),
        ["k".repeat(64)]: true,
      });
      expect(breadcrumbs?.[0]?.data).not.to.have.property("password");
      expect(breadcrumbs?.[0]?.data).not.to.have.property("authorization");
      expect(breadcrumbs?.[0]?.data).not.to.have.property("clientIp");
      expect(breadcrumbs?.[0]?.data).not.to.have.property("userId");
      expect(breadcrumbs?.[0]?.data).not.to.have.property("nested");
      expect(breadcrumbs?.[0]?.data).not.to.have.property("nan");
      expect(breadcrumbs?.[0]?.data).not.to.have.property("infinity");
    });
  });
});
