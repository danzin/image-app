import { expect } from "chai";
import { describe, it } from "mocha";
import {
  parseOutboxEventId,
  requireMongoUri,
} from "@/scripts/requeue-outbox-event";

describe("requeue-outbox-event script inputs", () => {
  it("accepts only canonical Mongo ObjectIds", () => {
    expect(
      parseOutboxEventId("507F1F77BCF86CD799439011"),
    ).to.equal("507f1f77bcf86cd799439011");
    expect(() => parseOutboxEventId("not-an-object-id")).to.throw(
      "Usage: node backend/dist/scripts/requeue-outbox-event.js <outbox-object-id>",
    );
  });

  it("loads and validates MONGODB_URI from the bootstrapped environment", () => {
    expect(
      requireMongoUri({
        MONGODB_URI: "  mongodb://localhost:27017/ascendance  ",
      }),
    ).to.equal("mongodb://localhost:27017/ascendance");
    expect(() => requireMongoUri({})).to.throw("MONGODB_URI is required");
  });
});
