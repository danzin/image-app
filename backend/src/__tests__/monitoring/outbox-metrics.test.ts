import { expect } from "chai";
import { describe, it } from "mocha";
import { MetricsService } from "@/metrics/metrics.service";

describe("outbox backlog metrics", () => {
  it("exports exhausted event count and oldest pending age", async () => {
    const metrics = new MetricsService();
    metrics.setOutboxBacklogStatus(2, new Date(Date.now() - 5_000));

    const output = await metrics.getMetrics();

    expect(output).to.match(
      /outbox_exhausted_events(?:\{[^}]*\})? 2(?:\r?\n|$)/,
    );
    expect(output).to.match(
      /outbox_oldest_pending_age_seconds(?:\{[^}]*\})? 5(?:\.\d+)?(?:\r?\n|$)/,
    );
  });
});
