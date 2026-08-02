import "reflect-metadata";
import { expect } from "chai";
import { describe, it } from "mocha";
import sinon from "sinon";
import { UpdateUserActivityCommand } from "@/application/commands/admin/updateUserActivity/updateUserActivity.command";
import { UpdateUserActivityCommandHandler } from "@/application/commands/admin/updateUserActivity/updateUserActivity.handler";

describe("UpdateUserActivityCommandHandler", () => {
  it("updates lastActive and lastIp independently of request-log persistence", async () => {
    const updateByPublicId = sinon.stub().resolves();
    const handler = new UpdateUserActivityCommandHandler({
      updateByPublicId,
    } as any);
    const before = Date.now();

    await handler.execute(
      new UpdateUserActivityCommand({
        userId: "11111111-1111-4111-8111-111111111111",
        ip: "203.0.113.10",
      }),
    );

    const [userId, update] = updateByPublicId.firstCall.args;
    expect(userId).to.equal("11111111-1111-4111-8111-111111111111");
    expect(update.$set.lastIp).to.equal("203.0.113.10");
    expect(update.$set.lastActive).to.be.instanceOf(Date);
    expect(update.$set.lastActive.getTime()).to.be.at.least(before);
  });
});
