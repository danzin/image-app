import "reflect-metadata";
import { expect } from "chai";
import { afterEach, beforeEach, describe, it } from "mocha";
import sinon from "sinon";
import type { Request, Response } from "express";
import { AuthController } from "@/controllers/auth.controller";
import { authCookieNames } from "@/config/cookieConfig";
import { logger } from "@/utils/winston";

describe("AuthController logout", () => {
  let authService: {
    extractSessionIdFromRefreshToken: sinon.SinonStub;
    revokeSessionByAccessToken: sinon.SinonStub;
    revokeSessionByRefreshToken: sinon.SinonStub;
  };
  let controller: AuthController;
  let res: Response;

  beforeEach(() => {
    authService = {
      extractSessionIdFromRefreshToken: sinon.stub().returns("session-1"),
      revokeSessionByAccessToken: sinon.stub().resolves(),
      revokeSessionByRefreshToken: sinon.stub().resolves(),
    };
    controller = new AuthController(authService as any, {} as any);
    res = {
      clearCookie: sinon.stub().returnsThis(),
      status: sinon.stub().returnsThis(),
      json: sinon.stub().returnsThis(),
    } as unknown as Response;
  });

  afterEach(() => {
    sinon.restore();
  });

  it("revokes by refresh token after the access token has expired", async () => {
    const req = {
      cookies: {
        [authCookieNames.refreshToken]: "refresh-token",
      },
    } as unknown as Request;

    await controller.logout(req, res);

    expect(
      authService.revokeSessionByRefreshToken.calledOnceWithExactly(
        "refresh-token",
      ),
    ).to.equal(true);
    expect(authService.revokeSessionByAccessToken.called).to.equal(false);
    expect((res.status as sinon.SinonStub).calledOnceWithExactly(200)).to.equal(
      true,
    );
  });

  it("attempts access and refresh revocation independently", async () => {
    const refreshFailure = new Error("refresh revocation failed");
    authService.revokeSessionByRefreshToken.rejects(refreshFailure);
    const warning = sinon.stub(logger, "warn");
    const req = {
      cookies: {
        [authCookieNames.accessToken]: "access-token",
        [authCookieNames.refreshToken]: "refresh-token",
      },
    } as unknown as Request;

    await controller.logout(req, res);

    expect(
      authService.revokeSessionByRefreshToken.calledOnceWithExactly(
        "refresh-token",
      ),
    ).to.equal(true);
    expect(
      authService.revokeSessionByAccessToken.calledOnceWithExactly(
        "access-token",
      ),
    ).to.equal(true);
    expect(warning.calledOnce).to.equal(true);
    expect((res.status as sinon.SinonStub).calledOnceWithExactly(200)).to.equal(
      true,
    );
  });
});
