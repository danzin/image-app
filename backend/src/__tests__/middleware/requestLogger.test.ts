import "reflect-metadata";
import { EventEmitter } from "node:events";
import { expect } from "chai";
import { afterEach, describe, it } from "mocha";
import sinon from "sinon";
import type { NextFunction, Request, Response } from "express";
import { LogAuthActivityCommand } from "@/application/commands/admin/logAuthActivity/logAuthActivity.command";
import { LogRequestCommand } from "@/application/commands/admin/logRequest/logRequest.command";
import { LogSecurityAuditCommand } from "@/application/commands/admin/logSecurityAudit/logSecurityAudit.command";
import { UpdateUserActivityCommand } from "@/application/commands/admin/updateUserActivity/updateUserActivity.command";
import { createRequestLogger } from "@/middleware/requestLogger";

describe("requestLogger persistence boundaries", () => {
  const originalPersistenceSetting =
    process.env.REQUEST_LOG_PERSISTENCE_ENABLED;
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    sinon.restore();
    restoreEnv(
      "REQUEST_LOG_PERSISTENCE_ENABLED",
      originalPersistenceSetting,
    );
    restoreEnv("NODE_ENV", originalNodeEnv);
  });

  it("keeps user and auth activity when generic request persistence is disabled", () => {
    process.env.NODE_ENV = "development";
    process.env.REQUEST_LOG_PERSISTENCE_ENABLED = "false";
    const dispatch = sinon.stub().resolves();
    const { req, res, next } = buildRequestCycle();
    const middleware = createRequestLogger(
      () => ({ dispatch }) as any,
    );

    middleware(req, res, next);
    (res as unknown as EventEmitter).emit("finish");

    const commands = dispatch.getCalls().map((call) => call.args[0]);
    expect(commands.some((command) => command instanceof LogRequestCommand)).to
      .equal(false);
    expect(
      commands.some((command) => command instanceof UpdateUserActivityCommand),
    ).to.equal(true);
    expect(
      commands.some((command) => command instanceof LogAuthActivityCommand),
    ).to.equal(true);
    expect(
      commands.some((command) => command instanceof LogSecurityAuditCommand),
    ).to.equal(true);
    expect(next.calledOnce).to.equal(true);
  });

  it("omits Referer from every retained log command", () => {
    process.env.REQUEST_LOG_PERSISTENCE_ENABLED = "true";
    const dispatch = sinon.stub().resolves();
    const { req, res, next, getHeader } = buildRequestCycle();
    const middleware = createRequestLogger(
      () => ({ dispatch }) as any,
    );

    middleware(req, res, next);
    (res as unknown as EventEmitter).emit("finish");

    const commands = dispatch.getCalls().map((call) => call.args[0]);
    expect(commands.some((command) => command instanceof LogRequestCommand)).to
      .equal(true);
    expect(JSON.stringify(commands)).to.not.include("referer");
    expect(getHeader.calledWith("referer")).to.equal(false);
  });

  it("updates activity for the first authenticated request", () => {
    process.env.REQUEST_LOG_PERSISTENCE_ENABLED = "false";
    const dispatch = sinon.stub().resolves();
    const middleware = createRequestLogger(() => ({ dispatch }) as any);
    const { req, res, next } = buildRequestCycle({
      authAction: null,
      route: "/api/posts",
    });

    middleware(req, res, next);
    (res as unknown as EventEmitter).emit("finish");

    expect(getActivityCommands(dispatch)).to.have.lengthOf(1);
  });

  it("does not update the same user again inside five minutes", () => {
    process.env.REQUEST_LOG_PERSISTENCE_ENABLED = "false";
    let currentTime = 1_000;
    sinon.stub(Date, "now").callsFake(() => currentTime);
    const dispatch = sinon.stub().resolves();
    const middleware = createRequestLogger(() => ({ dispatch }) as any);

    finishRequest(middleware, {
      authAction: null,
      route: "/api/posts",
    });
    currentTime = 300_999;
    finishRequest(middleware, {
      authAction: null,
      route: "/api/posts",
    });

    expect(getActivityCommands(dispatch)).to.have.lengthOf(1);
  });

  it("updates the same user after five minutes", () => {
    process.env.REQUEST_LOG_PERSISTENCE_ENABLED = "false";
    let currentTime = 1_000;
    sinon.stub(Date, "now").callsFake(() => currentTime);
    const dispatch = sinon.stub().resolves();
    const middleware = createRequestLogger(() => ({ dispatch }) as any);

    finishRequest(middleware, {
      authAction: null,
      route: "/api/posts",
    });
    currentTime = 301_000;
    finishRequest(middleware, {
      authAction: null,
      route: "/api/posts",
    });

    expect(getActivityCommands(dispatch)).to.have.lengthOf(2);
  });

  it("updates immediately when the user's IP changes", () => {
    process.env.REQUEST_LOG_PERSISTENCE_ENABLED = "false";
    sinon.stub(Date, "now").returns(1_000);
    const dispatch = sinon.stub().resolves();
    const middleware = createRequestLogger(() => ({ dispatch }) as any);

    finishRequest(middleware, {
      authAction: null,
      ip: "203.0.113.10",
      route: "/api/posts",
    });
    finishRequest(middleware, {
      authAction: null,
      ip: "203.0.113.11",
      route: "/api/posts",
    });

    const activityCommands = getActivityCommands(dispatch);
    expect(activityCommands).to.have.lengthOf(2);
    expect(activityCommands[1].payload.ip).to.equal("203.0.113.11");
  });

  it("never dispatches activity updates for anonymous requests", () => {
    process.env.REQUEST_LOG_PERSISTENCE_ENABLED = "false";
    const dispatch = sinon.stub().resolves();
    const middleware = createRequestLogger(() => ({ dispatch }) as any);

    finishRequest(middleware, {
      authAction: null,
      route: "/api/posts",
      userId: null,
    });

    expect(getActivityCommands(dispatch)).to.have.lengthOf(0);
  });

  it("retains route-based security audit classification", () => {
    process.env.REQUEST_LOG_PERSISTENCE_ENABLED = "false";
    const dispatch = sinon.stub().resolves();
    const middleware = createRequestLogger(() => ({ dispatch }) as any);

    finishRequest(middleware, {
      authAction: null,
      method: "DELETE",
      route: "/api/admin/user/target-user",
    });

    const securityCommand = dispatch
      .getCalls()
      .map((call) => call.args[0])
      .find((command) => command instanceof LogSecurityAuditCommand);

    expect(securityCommand).to.be.instanceOf(LogSecurityAuditCommand);
    if (!(securityCommand instanceof LogSecurityAuditCommand)) {
      throw new Error("Expected a security audit command");
    }
    expect(securityCommand.payload.eventType).to.equal("admin.user.deleted");
    expect(securityCommand.payload.target).to.deep.equal({
      type: "user",
      id: "target-user",
    });
  });
});

interface RequestCycleOptions {
  authAction?: string | null;
  ip?: string;
  method?: string;
  route?: string;
  userId?: string | null;
}

const DEFAULT_USER_ID = "11111111-1111-4111-8111-111111111111";

function buildRequestCycle(options: RequestCycleOptions = {}): {
  req: Request;
  res: Response;
  next: sinon.SinonStub;
  getHeader: sinon.SinonStub;
} {
  const authAction =
    "authAction" in options ? options.authAction : "login";
  const userId = "userId" in options ? options.userId : DEFAULT_USER_ID;
  const ip = options.ip ?? "203.0.113.10";
  const route = options.route ?? "/api/users/login";
  const getHeader = sinon.stub().callsFake((name: string) => {
    const headers: Record<string, string> = {
      origin: "https://app.example.com",
      referer: "https://app.example.com/private?token=secret",
      "user-agent": "request-logger-test",
    };
    return headers[name.toLowerCase()];
  });
  const req = {
    authLogMetadata:
      authAction || userId
        ? {
            ...(authAction ? { authAction } : {}),
            authSource: "credentials",
            authState: userId ? "authenticated" : "anonymous",
            ...(userId ? { userId } : {}),
          }
        : undefined,
    correlationId: "correlation-1",
    decodedUser: undefined,
    get: getHeader,
    ip,
    method: options.method ?? "POST",
    originalUrl: `${route}?token=secret`,
    socket: { remoteAddress: ip },
    url: `${route}?token=secret`,
  } as unknown as Request;
  const res = new EventEmitter() as unknown as Response;
  Object.assign(res, { statusCode: 200 });
  const next = sinon.stub() as unknown as NextFunction & sinon.SinonStub;

  return { req, res, next, getHeader };
}

function finishRequest(
  middleware: ReturnType<typeof createRequestLogger>,
  options: RequestCycleOptions,
): void {
  const { req, res, next } = buildRequestCycle(options);
  middleware(req, res, next);
  (res as unknown as EventEmitter).emit("finish");
}

function getActivityCommands(
  dispatch: sinon.SinonStub,
): UpdateUserActivityCommand[] {
  return dispatch
    .getCalls()
    .map((call) => call.args[0])
    .filter(
      (command): command is UpdateUserActivityCommand =>
        command instanceof UpdateUserActivityCommand,
    );
}

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
}
