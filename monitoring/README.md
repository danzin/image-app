# Production Loki and Alloy

The production Compose file adds Loki and Grafana Alloy only when the existing
`monitoring` profile is enabled:

- Alloy reads Docker stdout/stderr only from the `ascendance-social` Compose
  project through the Docker socket and forwards logs to Loki over the private
  Compose network. Docker-socket access is privileged; keep Alloy limited to
  this trusted deployment.
- Loki runs as a single binary with TSDB v13 and filesystem storage in the
  named `loki_data` volume.
- Alloy stores Docker read positions and component state in the named
  `alloy_data` volume.
- Grafana provisions Loki as the non-default `loki` datasource. Prometheus
  remains the default datasource.

Loki and Alloy have no host-published ports and no Caddy route. Alloy's debug
HTTP server is reachable only from the Compose network unless a temporary
localhost-only port is added for diagnosis.

## Indexed labels and log bodies

Alloy indexes only these bounded labels:

- `service_name`
- `container`
- `compose_project`
- `stream` (`stdout` or `stderr`)
- `level` when the structured JSON line contains it

Correlation IDs, error IDs, user IDs, request IDs, resource IDs, and the other
structured fields remain in the original JSON log body. Parse those fields at
query time instead of adding them to Loki stream labels, for example:

```logql
{service_name="backend", level="error"} | json | line_format `{{.event}} {{.errorId}} {{.correlationId}}`
```

## Deployment and verification

Run these commands from the repository root on the production host with the
deployment environment available:

```bash
docker compose -f docker-compose-prod.yml --profile monitoring config --quiet
docker compose -f docker-compose-prod.yml --profile monitoring up -d loki alloy grafana
docker compose -f docker-compose-prod.yml --profile monitoring ps loki alloy grafana
docker compose -f docker-compose-prod.yml --profile monitoring logs --tail=100 loki alloy
```

Loki readiness should return HTTP 200, and Alloy should report ready after its
configuration loads. From a container on the Compose network, check:

```bash
docker compose -f docker-compose-prod.yml --profile monitoring exec grafana \
  wget -qO- http://loki:3100/ready
docker compose -f docker-compose-prod.yml --profile monitoring exec grafana \
  wget -qO- http://alloy:12345/-/ready
```

Open Grafana through the existing localhost-only binding or an approved SSH
tunnel, select the `Loki` datasource in Explore, and query the labels above.
Do not add Loki or Alloy hostnames to Caddy. For a temporary host debug port,
bind it to `127.0.0.1`, never to all host interfaces.

## Focused validation

The static deployment contract test can be run with:

```bash
npm run test-backend -- --grep "production monitoring configuration"
```

The deployment host should also validate the pinned images and config files
before a rollout:

```bash
docker run --rm \
  -v "$PWD/monitoring/loki:/config:ro" \
  grafana/loki:3.7.4 \
  -config.file=/config/loki-config.yml -verify-config
docker run --rm \
  -v "$PWD/monitoring/alloy:/config:ro" \
  grafana/alloy:v1.18.0 \
  validate /config/config.alloy
```

No Grafana dashboards are provisioned by this phase.
