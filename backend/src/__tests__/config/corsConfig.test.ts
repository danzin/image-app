import { expect } from "chai";
import sinon from "sinon";
import { buildCorsOptions, isAllowedOrigin } from "@/config/corsConfig";
import { logger } from "@/utils/winston";

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

describe("origin policy", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalAllowedOrigins = process.env.ALLOWED_ORIGINS;

  afterEach(() => {
    restoreEnvironmentVariable("NODE_ENV", originalNodeEnv);
    restoreEnvironmentVariable("ALLOWED_ORIGINS", originalAllowedOrigins);
  });

  it("accepts only the exact canonical configured origin", () => {
    process.env.NODE_ENV = "production";
    process.env.ALLOWED_ORIGINS = "https://allowed.example";

    expect(isAllowedOrigin("https://allowed.example")).to.equal(true);
    expect(isAllowedOrigin("https://allowed.example.attacker.test")).to.equal(
      false,
    );
    expect(isAllowedOrigin("https://allowed.example/path")).to.equal(false);
    expect(isAllowedOrigin("https://allowed.example?query=1")).to.equal(false);
    expect(isAllowedOrigin("https://user:pass@allowed.example")).to.equal(
      false,
    );
    expect(isAllowedOrigin("not-an-origin")).to.equal(false);
    expect(isAllowedOrigin("null")).to.equal(false);
  });

  it("fails closed for an empty production allowlist", () => {
    process.env.NODE_ENV = "production";
    delete process.env.ALLOWED_ORIGINS;

    expect(isAllowedOrigin("https://allowed.example")).to.equal(false);
  });

  it("keeps configured local-development origins available", () => {
    process.env.NODE_ENV = "development";
    delete process.env.ALLOWED_ORIGINS;

    expect(isAllowedOrigin("http://localhost:5173")).to.equal(true);
  });

  it("logs blocked origins as a stable event without the raw header value", () => {
    const warn = sinon.stub(logger, "warn");
    const corsOptions = buildCorsOptions();

    try {
      (corsOptions.origin as Function)("https://attacker.example", sinon.stub());
      expect(
        warn.calledOnceWithExactly({
          message: "CORS origin blocked",
          event: "cors.origin.blocked",
        }),
      ).to.equal(true);
    } finally {
      warn.restore();
    }
  });
});
