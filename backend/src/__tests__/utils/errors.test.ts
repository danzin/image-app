import { expect } from "chai";
import express from "express";
import { describe, it } from "mocha";
import { Writable } from "node:stream";
import jwt from "jsonwebtoken";
import request from "supertest";
import sinon from "sinon";
import winston from "winston";
import { correlationIdMiddleware } from "@/middleware/correlationId.middleware";
import { buildCorsOptions } from "@/config/corsConfig";
import { AppError, ErrorHandler, ErrorCode, Errors } from "@/utils/errors";
import { errorLogger } from "@/utils/winston";
import { addRequestContextBreadcrumb } from "@/runtime/request-context";

function restoreEnvironmentVariable(
  key: string,
  previousValue: string | undefined,
): void {
  if (previousValue === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = previousValue;
  }
}

describe("ErrorHandler", () => {
  function buildApp(error: unknown): express.Express {
    const app = express();
    app.use(correlationIdMiddleware);
    app.use((req, _res, next) => {
      req._startTime = Date.now() - 10;
      req.decodedUser = { publicId: "user-public-123" } as never;
      next();
    });
    app.get("/widgets/:widgetId", (_req, _res, next) => {
      addRequestContextBreadcrumb("http.handler.failed", { operation: "widget.read" });
      next(error);
    });
    app.use(ErrorHandler.handleError);
    return app;
  }

  it("logs one normalized terminal record and returns an error ID for 5xx failures", async () => {
    const logError = sinon.stub(errorLogger, "error");
    const previousNodeEnv = process.env.NODE_ENV;
    const previousRelease = process.env.RELEASE;
    process.env.NODE_ENV = "test";
    process.env.RELEASE = "release-123";

    try {
      const cause = Object.assign(new Error("Redis password=secret"), {
        code: "ECONNREFUSED",
      });
      const response = await request(
        buildApp(
          new AppError("DatabaseError", "database unavailable", 503, {
            cause,
            errorCode: ErrorCode.DATABASE_ERROR,
          }),
        ),
      )
        .get("/widgets/widget-123?include=secret")
        .set("X-Request-ID", "correlation-123")
        .set("X-Client-Request-ID", "client-request-123")
        .set("X-Client-Boot-ID", "client-boot-123")
        .set("X-Client-Request-Attempt", "2")
        .set("X-Axios-Retry", "true")
        .set("X-Previous-Client-Request-ID", "previous-request-123")
        .set("X-Caused-By-Client-Request-ID", "cause-request-123")
        .expect(503);

      expect(response.headers["x-error-id"]).to.match(
        /^[0-9a-f-]{36}$/i,
      );
      expect(response.body.error).to.include({
        type: "DatabaseError",
        message: "Internal server error",
        code: 503,
        errorCode: ErrorCode.DATABASE_ERROR,
        errorId: response.headers["x-error-id"],
      });
      expect(logError.calledOnce).to.equal(true);

      const record = logError.firstCall.args[0] as Record<string, unknown>;
      expect(record).to.include({
        event: "http.request.error",
        errorId: response.headers["x-error-id"],
        correlationId: "correlation-123",
        method: "GET",
        route: "/widgets/:widgetId",
        matchedRoute: "/widgets/:widgetId",
        statusCode: 503,
        userId: "user-public-123",
        clientRequestId: "client-request-123",
        clientBootId: "client-boot-123",
        clientRequestAttempt: 2,
        axiosRetry: true,
        previousClientRequestId: "previous-request-123",
        causedByClientRequestId: "cause-request-123",
        service: "ascendance-backend",
        env: "test",
        release: "release-123",
      });
      expect(record.durationMs).to.be.a("number");
      expect(record.breadcrumbs).to.be.an("array");
      expect(
        (record.breadcrumbs as Array<{ event: string; data?: { operation?: string } }>).find(
          ({ event }) => event === "http.handler.failed",
        )?.data?.operation,
      ).to.equal("widget.read");
      expect(JSON.stringify(record)).not.to.include("secret");
      expect(record).not.to.have.property("ip");
      expect(record).not.to.have.property("userAgent");
      expect(record).not.to.have.property("originalUrl");
      expect(record.error).to.deep.include({
        name: "DatabaseError",
        statusCode: 503,
        errorCode: ErrorCode.DATABASE_ERROR,
      });
      expect((record.error as Record<string, unknown>).cause).to.deep.include({
        name: "Error",
        code: "ECONNREFUSED",
      });
    } finally {
      restoreEnvironmentVariable("NODE_ENV", previousNodeEnv);
      restoreEnvironmentVariable("RELEASE", previousRelease);
      logError.restore();
    }
  });

  it("preserves 4xx semantics while avoiding an error-level terminal log", async () => {
    const logError = sinon.stub(errorLogger, "error");
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    try {
      const response = await request(
        buildApp(
          new AppError("ValidationError", "widget ID is invalid", 400, {
            errorCode: ErrorCode.VALIDATION_FAILED,
          }),
        ),
      ).get("/widgets/invalid").expect(400);

      expect(response.body.error).to.include({
        type: "ValidationError",
        message: "widget ID is invalid",
        code: 400,
        errorCode: ErrorCode.VALIDATION_FAILED,
        errorId: response.headers["x-error-id"],
      });
      expect(response.headers["x-error-id"]).to.match(/^[0-9a-f-]{36}$/i);
      expect(logError.called).to.equal(false);
    } finally {
      restoreEnvironmentVariable("NODE_ENV", previousNodeEnv);
      logError.restore();
    }
  });

  it("returns only serialized detail in development responses", async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";

    try {
      const response = await request(
        buildApp(
          new AppError("DatabaseError", "database unavailable", 503, {
            context: {
              operation: "loadWidget",
              password: "not exposed",
              nested: { token: "not exposed" },
            },
            cause: new Error("Redis password=secret"),
          }),
        ),
      )
        .get("/widgets/widget-123")
        .expect(503);

      expect(response.body.error.context).to.deep.equal({
        operation: "loadWidget",
      });
      expect(response.body.error.cause).to.include({ name: "Error" });
      expect(JSON.stringify(response.body.error)).not.to.include("secret");
      expect(JSON.stringify(response.body.error)).not.to.include("not exposed");
    } finally {
      restoreEnvironmentVariable("NODE_ENV", previousNodeEnv);
    }
  });

  it("never exposes authentication causes or debug details in development", async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    const jwtCause = new jwt.JsonWebTokenError("invalid signature");
    const authenticationError = Errors.authentication("Invalid token", {
      errorCode: ErrorCode.TOKEN_INVALID,
      cause: jwtCause,
    });

    try {
      const response = await request(buildApp(authenticationError))
        .get("/widgets/widget-123")
        .expect(401);

      expect(authenticationError.cause).to.equal(jwtCause);
      expect(response.body.error).to.include({
        type: "AuthenticationError",
        message: "Invalid token",
        code: 401,
        errorCode: ErrorCode.TOKEN_INVALID,
      });
      expect(response.body.error).not.to.have.any.keys("stack", "cause", "errors");
      expect(JSON.stringify(response.body.error)).not.to.include("JsonWebTokenError");
      expect(JSON.stringify(response.body.error)).not.to.include("invalid signature");
    } finally {
      restoreEnvironmentVariable("NODE_ENV", previousNodeEnv);
    }
  });

  it("never exposes unauthorized or authentication-forbidden debug details in development", async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    const cases = [
      {
        error: Errors.unauthorized("Unauthorized access", {
          cause: new Error("unauthorized verification detail"),
        }),
        statusCode: 401,
        type: "UnauthorizedError",
        detail: "unauthorized verification detail",
      },
      {
        error: Errors.authenticationForbidden("Account banned", {
          cause: new Error("ban verification detail"),
        }),
        statusCode: 403,
        type: "ForbiddenError",
        detail: "ban verification detail",
      },
    ];

    try {
      for (const testCase of cases) {
        const response = await request(buildApp(testCase.error))
          .get("/widgets/widget-123")
          .expect(testCase.statusCode);

        expect(response.body.error).to.include({ type: testCase.type });
        expect(response.body.error).not.to.have.any.keys(
          "context",
          "stack",
          "cause",
          "errors",
        );
        expect(JSON.stringify(response.body.error)).not.to.include(
          testCase.detail,
        );
      }
    } finally {
      restoreEnvironmentVariable("NODE_ENV", previousNodeEnv);
    }
  });

  it("hides unexpected 5xx messages in production while retaining the error ID", async () => {
    const logError = sinon.stub(errorLogger, "error");
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    try {
      const response = await request(buildApp(new Error("Mongo password=secret")))
        .get("/widgets/widget-123")
        .expect(500);

      expect(response.body.error).to.include({
        type: "UnknownError",
        message: "Internal server error",
        code: 500,
        errorId: response.headers["x-error-id"],
      });
      expect(JSON.stringify(response.body)).not.to.include("secret");
      expect(logError.calledOnce).to.equal(true);
      const record = logError.firstCall.args[0] as Record<string, unknown>;
      expect(record.errorId).to.equal(response.headers["x-error-id"]);
      expect(JSON.stringify(record.error)).not.to.include("secret");
    } finally {
      restoreEnvironmentVariable("NODE_ENV", previousNodeEnv);
      logError.restore();
    }
  });

  it("drops unsafe client identifiers and never logs a concrete route path", async () => {
    const logError = sinon.stub(errorLogger, "error");

    try {
      await request(buildApp(new Error("failure")))
        .get("/widgets/reset-token-value")
        .set("X-Request-ID", "Bearer secret-token")
        .set("X-Client-Request-ID", "password=hunter2")
        .set("X-Client-Boot-ID", "x".repeat(129))
        .set("X-Previous-Client-Request-ID", "contains space")
        .set("X-Caused-By-Client-Request-ID", "caused-by-valid")
        .expect(500);

      const record = logError.firstCall.args[0] as Record<string, unknown>;
      const recordText = JSON.stringify(record);
      expect(record.correlationId).to.match(/^[0-9a-f-]{36}$/i);
      expect(record).not.to.have.property("clientRequestId");
      expect(record).not.to.have.property("clientBootId");
      expect(record).not.to.have.property("previousClientRequestId");
      expect(record.causedByClientRequestId).to.equal("caused-by-valid");
      expect(record.route).to.equal("/widgets/:widgetId");
      expect(recordText).not.to.include("secret-token");
      expect(recordText).not.to.include("hunter2");
      expect(recordText).not.to.include("reset-token-value");
    } finally {
      logError.restore();
    }
  });

  it("serializes a metrics tracking failure as a separate error record", async () => {
    const logError = sinon.stub(errorLogger, "error");
    let metricsEndpoint: string | undefined;
    ErrorHandler.setMetricsCallback((params) => {
      metricsEndpoint = params.endpoint;
      throw new Error("metrics password=secret");
    });

    try {
      const response = await request(buildApp(new Error("request failure")))
        .get("/widgets/widget-123")
        .expect(500);

      expect(logError.callCount).to.equal(2);
      const metricsRecord = logError.firstCall.args[0] as Record<string, unknown>;
      expect(metricsRecord).to.include({
        event: "metrics.error_tracking.failed",
        errorId: response.headers["x-error-id"],
      });
      expect(metricsEndpoint).to.equal("/widgets/:widgetId");
      expect(JSON.stringify(metricsRecord.error)).not.to.include("secret");
    } finally {
      ErrorHandler.setMetricsCallback(undefined as never);
      logError.restore();
    }
  });

  it("exposes the error ID response header to browser clients", () => {
    expect(buildCorsOptions().exposedHeaders).to.include("X-Error-ID");
  });

  it("emits the terminal error shape through Winston JSON formatting", async () => {
    const chunks: string[] = [];
    const stream = new Writable({
      write(chunk, _encoding, callback) {
        chunks.push(chunk.toString());
        callback();
      },
    });
    const originalTransports = [...errorLogger.transports];
    errorLogger.clear();
    errorLogger.add(new winston.transports.Stream({ stream }));

    try {
      errorLogger.error({
        message: "HTTP request failed",
        event: "http.request.error",
        errorId: "error-id-123",
        error: new AppError("DatabaseError", "database unavailable", 503),
      });
      await new Promise<void>((resolve) => setImmediate(resolve));

      const output = JSON.parse(chunks.join("")) as Record<string, unknown>;
      expect(output).to.include({
        level: "error",
        event: "http.request.error",
        errorId: "error-id-123",
      });
      expect(output.error).to.deep.include({ name: "DatabaseError" });
    } finally {
      errorLogger.clear();
      for (const transport of originalTransports) {
        errorLogger.add(transport);
      }
    }
  });
});
