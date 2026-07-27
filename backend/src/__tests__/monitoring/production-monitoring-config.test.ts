import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "mocha";
import { expect } from "chai";

const repositoryRoot = resolve(__dirname, "../../../..");

function readRepositoryFile(relativePath: string): string {
  return readFileSync(resolve(repositoryRoot, relativePath), "utf8");
}

function serviceBlock(compose: string, serviceName: string): string {
  const match = compose.match(
    new RegExp(`\\n  ${serviceName}:\\n([\\s\\S]*?)(?=\\n  [a-z0-9-]+:\\n|\\nnetworks:)`),
  );

  expect(match, `${serviceName} service is missing`).to.not.equal(null);
  return match?.[1] ?? "";
}

describe("production monitoring configuration", () => {
  it("keeps Loki and Alloy profile-gated and private", () => {
    const compose = readRepositoryFile("docker-compose-prod.yml");
    const loki = serviceBlock(compose, "loki");
    const alloy = serviceBlock(compose, "alloy");

    expect(loki).to.include('image: grafana/loki:3.7.4');
    expect(loki).to.include('profiles: ["monitoring"]');
    expect(loki).to.include('"-target=all"');
    expect(loki).to.include("loki_data:/loki");
    expect(loki).to.not.include("ports:");

    expect(alloy).to.include('image: grafana/alloy:v1.18.0');
    expect(alloy).to.include('profiles: ["monitoring"]');
    expect(alloy).to.include("/var/run/docker.sock:/var/run/docker.sock:ro");
    expect(alloy).to.include("alloy_data:/var/lib/alloy/data");
    expect(alloy).to.include("--storage.path=/var/lib/alloy/data");
    expect(alloy).to.not.include("ports:");

    expect(compose).to.include("loki_data:");
    expect(compose).to.include("alloy_data:");
  });

  it("uses persistent TSDB v13 filesystem storage with finite retention", () => {
    const config = readRepositoryFile("monitoring/loki/loki-config.yml");

    expect(config).to.include("chunks_directory: /loki/chunks");
    expect(config).to.include("store: tsdb");
    expect(config).to.include("object_store: filesystem");
    expect(config).to.include("schema: v13");
    expect(config).to.include("retention_period: 168h");
    expect(config).to.include("retention_enabled: true");
    expect(config).to.include("delete_request_store: filesystem");
  });

  it("indexes only bounded labels and retains structured log lines", () => {
    const config = readRepositoryFile("monitoring/alloy/config.alloy");

    for (const label of [
      "service_name",
      "container",
      "compose_project",
      "stream",
      "level",
    ]) {
      expect(config).to.include(`"${label}"`);
    }

    expect(config).to.include("loki.source.docker");
    expect(config).to.include('name   = "label"');
    expect(config).to.include(
      '"com.docker.compose.project=ascendance-social"',
    );
    expect(config).to.include("relabel_rules = discovery.relabel.docker_logs.rules");
    expect(config).to.not.include("stage.output");

    for (const field of ["correlationId", "errorId", "userId", "requestId", "resourceId"]) {
      expect(config).to.not.include(field);
    }
  });

  it("provisions Loki as a non-default Grafana datasource", () => {
    const datasources = readRepositoryFile(
      "monitoring/grafana/provisioning/datasources/datasources.yml",
    );

    expect(datasources).to.include("name: Loki");
    expect(datasources).to.include("uid: loki");
    expect(datasources).to.include("type: loki");
    expect(datasources).to.include("url: http://loki:3100");
    expect(datasources).to.include("isDefault: false");
    expect(datasources).to.include("isDefault: true");
  });
});
