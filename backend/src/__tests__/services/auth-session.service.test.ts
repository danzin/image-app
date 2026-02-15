import "reflect-metadata";
import { expect } from "chai";
import sinon from "sinon";
import crypto from "crypto";
import { AuthSessionService } from "@/services/auth-session.service";
import { RedisService } from "@/services/redis.service";

describe("AuthSessionService", () => {
	let authSessionService: AuthSessionService;
	let getStub: sinon.SinonStub;
	let sMembersStub: sinon.SinonStub;
	let delStub: sinon.SinonStub;
	let multiStub: sinon.SinonStub;
	let pipelineSetExStub: sinon.SinonStub;
	let pipelineSAddStub: sinon.SinonStub;
	let pipelineExpireStub: sinon.SinonStub;
	let pipelineDelStub: sinon.SinonStub;
	let pipelineSRemStub: sinon.SinonStub;
	let pipelineExecStub: sinon.SinonStub;

	beforeEach(() => {
		pipelineSetExStub = sinon.stub().returnsThis();
		pipelineSAddStub = sinon.stub().returnsThis();
		pipelineExpireStub = sinon.stub().returnsThis();
		pipelineDelStub = sinon.stub().returnsThis();
		pipelineSRemStub = sinon.stub().returnsThis();
		pipelineExecStub = sinon.stub().resolves([]);

		multiStub = sinon.stub().returns({
			setEx: pipelineSetExStub,
			sAdd: pipelineSAddStub,
			expire: pipelineExpireStub,
			del: pipelineDelStub,
			sRem: pipelineSRemStub,
			exec: pipelineExecStub,
		});

		sMembersStub = sinon.stub().resolves([]);
		delStub = sinon.stub().resolves(1);
		getStub = sinon.stub();

		const mockRedisService = {
			get: getStub,
			clientInstance: {
				multi: multiStub,
				sMembers: sMembersStub,
				del: delStub,
			},
		} as unknown as RedisService;

		authSessionService = new AuthSessionService(mockRedisService);
	});

	afterEach(() => {
		sinon.restore();
	});

	it("creates a session and persists session plus user-session index", async () => {
		const sid = "3f7c90af-22a8-4a48-8e03-3ea6f865b59f";
		const refreshToken = `${sid}.refresh-secret`;

		const session = await authSessionService.createSession({
			sid,
			publicId: "user-public-id",
			refreshToken,
			ttlSeconds: 3600,
			ip: "127.0.0.1",
			userAgent: "test-agent",
		});

		expect(session.sid).to.equal(sid);
		expect(session.publicId).to.equal("user-public-id");
		expect(session.status).to.equal("active");
		expect(session.refreshTokenHash).to.not.equal(refreshToken);
		expect(pipelineSetExStub.calledOnce).to.be.true;
		expect(pipelineSAddStub.calledWith("user:sessions:user-public-id", sid)).to.be.true;
		expect(pipelineExpireStub.calledWith("user:sessions:user-public-id", 3600)).to.be.true;
	});

	it("validates refresh token when stored hash matches", async () => {
		const sid = "3f7c90af-22a8-4a48-8e03-3ea6f865b59f";
		const refreshToken = `${sid}.refresh-secret`;
		const refreshTokenHash = crypto.createHash("sha256").update(refreshToken, "utf8").digest("hex");

		getStub.resolves({
			sid,
			publicId: "user-public-id",
			refreshTokenHash,
			createdAt: Date.now(),
			lastSeenAt: Date.now(),
			status: "active",
		});

		const session = await authSessionService.validateRefreshToken(refreshToken);
		expect(session.sid).to.equal(sid);
		expect(session.publicId).to.equal("user-public-id");
	});

	it("revokes session and throws when refresh token hash mismatches", async () => {
		const sid = "3f7c90af-22a8-4a48-8e03-3ea6f865b59f";
		const refreshToken = `${sid}.refresh-secret`;

		getStub.onFirstCall().resolves({
			sid,
			publicId: "user-public-id",
			refreshTokenHash: crypto.createHash("sha256").update("different-token", "utf8").digest("hex"),
			createdAt: Date.now(),
			lastSeenAt: Date.now(),
			status: "active",
		});
		getStub.onSecondCall().resolves({
			sid,
			publicId: "user-public-id",
			refreshTokenHash: crypto.createHash("sha256").update("different-token", "utf8").digest("hex"),
			createdAt: Date.now(),
			lastSeenAt: Date.now(),
			status: "active",
		});

		await expect(authSessionService.validateRefreshToken(refreshToken)).to.be.rejectedWith("Refresh token reuse detected");
		expect(pipelineDelStub.calledWith(`session:${sid}`)).to.be.true;
		expect(pipelineSRemStub.calledWith("user:sessions:user-public-id", sid)).to.be.true;
	});

	it("revokes all sessions for a user", async () => {
		sMembersStub.resolves(["session-a", "session-b"]);

		await authSessionService.revokeAllSessionsForUser("user-public-id");

		expect(delStub.calledOnce).to.be.true;
		const deleteArgs = delStub.getCall(0).args[0] as string[];
		expect(deleteArgs).to.deep.equal([
			"session:session-a",
			"session:session-b",
			"user:sessions:user-public-id",
		]);
	});
});
