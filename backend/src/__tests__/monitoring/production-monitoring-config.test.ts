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
    new RegExp(
      `\\r?\\n  ${serviceName}:\\r?\\n([\\s\\S]*?)(?=\\r?\\n  [a-z0-9-]+:\\r?\\n|\\r?\\nnetworks:)`,
    ),
  );

  expect(match, `${serviceName} service is missing`).to.not.equal(null);
  return match?.[1] ?? "";
}

describe("production monitoring configuration", () => {
  it("keeps Loki and Alloy profile-gated and private", () => {
    const compose = readRepositoryFile("docker-compose-prod.yml");
    const loki = serviceBlock(compose, "loki");
    const alloy = serviceBlock(compose, "alloy");

    expect(loki).to.include("image: grafana/loki:3.7.4");
    expect(loki).to.include('profiles: ["monitoring"]');
    expect(loki).to.include("loki_data:/loki");
    expect(loki).to.include('127.0.0.1:3100:3100');

    expect(alloy).to.include("image: grafana/alloy:v1.18.0");
    expect(alloy).to.include('profiles: ["monitoring"]');
    expect(alloy).to.include("/var/run/docker.sock:/var/run/docker.sock:ro");
    expect(alloy).to.include("alloy_data:/var/lib/alloy/data");
    expect(alloy).to.include("--storage.path=/var/lib/alloy/data");
    expect(alloy).to.include('127.0.0.1:12345:12345');

    expect(compose).to.include("loki_data:");
    expect(compose).to.include("alloy_data:");
  });

  it("gates Loki consumers on an internal readiness probe", () => {
    const compose = readRepositoryFile("docker-compose-prod.yml");
    const loki = serviceBlock(compose, "loki");
    const readiness = serviceBlock(compose, "loki-readiness");
    const alloy = serviceBlock(compose, "alloy");
    const grafana = serviceBlock(compose, "grafana");

    expect(loki).to.not.include("healthcheck:");

    expect(readiness).to.include("image: curlimages/curl:8.12.1");
    expect(readiness).to.include('profiles: ["monitoring"]');
    expect(readiness).to.include("http://loki:3100/ready");
    expect(readiness).to.include("read_only: true");
    expect(readiness).to.include("no-new-privileges:true");
    expect(readiness).to.include("pids_limit: 16");
    expect(readiness).to.not.include("ports:");
    expect(readiness).to.not.include("/var/run/docker.sock");
    expect(readiness).to.match(
      /depends_on:[\s\S]*?loki:[\s\S]*?condition:\s*service_started/,
    );
    expect(readiness).to.match(/cap_drop:[\s\S]*?-\s*ALL/);

    for (const dependent of [alloy, grafana]) {
      expect(dependent).to.match(
        /depends_on:[\s\S]*?loki-readiness:[\s\S]*?condition:\s*service_healthy/,
      );
    }
  });

  it("uses persistent TSDB v13 filesystem storage with finite retention", () => {
    const config = readRepositoryFile("monitoring/loki/loki-config.yml");

    expect(config).to.include("chunks_directory: /loki/chunks");
    expect(config).to.include("store: tsdb");
    expect(config).to.include("object_store: filesystem");
    expect(config).to.include("schema: v13");
    expect(config).to.include("retention_period: 336h");
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
    expect(config).to.include("stage.labels");

    expect(config).to.match(
      /rule\s*\{[\s\S]*?"__meta_docker_container_label_com_docker_compose_project"[\s\S]*?regex\s*=\s*"ascendance-social"[\s\S]*?action\s*=\s*"keep"[\s\S]*?\}/,
    );

    expect(config).to.match(
      /targets\s*=\s*discovery\.relabel\.containers\.output/,
    );
    expect(config).to.not.include("stage.output");

    expect(config).to.match(/correlation_id\s*=\s*"correlationId"/);
    expect(config).to.match(/error_id\s*=\s*"errorId"/);

    for (const field of [
      "userId",
      "requestId",
      "resourceId",
    ]) {
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
