import "reflect-metadata";
import { expect } from "chai";
import sinon, { SinonStub } from "sinon";
import { RedisNotificationModule } from "@/services/redis/redis-notification.module";

describe("RedisNotificationModule", () => {
	let notificationModule: RedisNotificationModule;
	let mockClient: {
		lRange: SinonStub;
		multi: SinonStub;
	};
	let pipeline: {
		hGet: SinonStub;
		hSet: SinonStub;
		exec: SinonStub;
	};

	beforeEach(() => {
		pipeline = {
			hGet: sinon.stub().returnsThis(),
			hSet: sinon.stub().returnsThis(),
			exec: sinon.stub(),
		};

		mockClient = {
			lRange: sinon.stub(),
			multi: sinon.stub().returns(pipeline),
		};

		notificationModule = new RedisNotificationModule(mockClient as any);
	});

	afterEach(() => {
		sinon.restore();
	});

	it("reads notification ids directly from the Redis list", async () => {
		mockClient.lRange.resolves(["notif-1", "notif-2"]);

		const ids = await notificationModule.getUserNotificationIds("user-123");

		expect(ids).to.deep.equal(["notif-1", "notif-2"]);
		expect(mockClient.lRange.calledOnceWith("notifications:user:user-123", 0, -1)).to.be.true;
	});

	it("marks multiple cached notifications read in one pipeline", async () => {
		pipeline.exec.resolves([]);

		await notificationModule.markNotificationsRead(["notif-1", "notif-2"]);

		expect(pipeline.hSet.firstCall.args).to.deep.equal(["notification:notif-1", "isRead", "1"]);
		expect(pipeline.hSet.secondCall.args).to.deep.equal(["notification:notif-2", "isRead", "1"]);
		expect(pipeline.exec.calledOnce).to.be.true;
	});

	it("does not count missing notification hashes as unread", async () => {
		mockClient.lRange.resolves(["notif-1", "notif-2", "notif-3"]);
		pipeline.exec.resolves(["1", null, "0"]);

		const unreadCount = await notificationModule.getUnreadNotificationCount("user-123");

		expect(unreadCount).to.equal(1);
	});
});
