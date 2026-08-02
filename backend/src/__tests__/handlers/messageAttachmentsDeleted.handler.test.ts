import "reflect-metadata";
import { expect } from "chai";
import { afterEach, describe, it } from "mocha";
import sinon from "sinon";
import { MessageAttachmentsDeletedEvent } from "@/application/events/message/message.event";
import { MessageAttachmentsDeletedHandler } from "@/application/handlers/message/MessageAttachmentsDeletedHandler";
import { logger } from "@/utils/winston";

describe("MessageAttachmentsDeletedHandler", () => {
  afterEach(() => {
    sinon.restore();
  });

  it("does not delete or expose legacy attachment identifiers", async () => {
    const warning = sinon.stub(logger, "warn");
    const handler = new MessageAttachmentsDeletedHandler();
    const unsafePublicId = "untrusted/legacy/public-id";

    await handler.handle(
      new MessageAttachmentsDeletedEvent([unsafePublicId]),
    );

    expect(warning.calledOnce).to.equal(true);
    const warningArgs = warning.firstCall.args as unknown as [
      string,
      { event: string; attachmentCount: number },
    ];
    expect(warningArgs[1]).to.deep.equal({
      event: "messaging.attachment_cleanup.skipped",
      attachmentCount: 1,
    });
    expect(JSON.stringify(warning.firstCall.args)).to.not.include(
      unsafePublicId,
    );
  });
});
