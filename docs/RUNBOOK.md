# Bandboard local-demo runbook

## Start and stop

Requirements: Docker Desktop with Compose.

```bash
docker compose up --build -d
docker compose ps
curl --fail http://localhost:8080/api/demo/health
```

Open <http://localhost:8080>. Stop services with `docker compose down`. The named MySQL volume persists local state; `docker compose down -v` intentionally destroys that disposable demo database and requires explicit operator intent.

## Verify the golden path

1. Confirm Command shows 82% readiness and one uncovered tenor sax part.
2. Assign Alex Rivera.
3. Publish revision 4.
4. Switch to the member view and acknowledge the update.
5. Confirm readiness is 100%, three jobs appear in Operations, and the audit trail records the actions.

Use **Reset demo** to restore the opening state. API documentation is available at <http://localhost:8080/api/docs>.

## Health and logs

```bash
curl --fail http://localhost:8080/api/demo/health
docker compose ps
docker compose logs --tail=100 api
docker compose logs --tail=100 mysql
docker compose logs --tail=100 web
```

API access logs are structured JSON and include method, path, status, duration, and request ID. A response's `x-request-id` can be matched to the API log. There is no hosted log aggregation or alerting in Level 0.

## Common failures

- `8080` already in use: stop the conflicting local process or change the host-side web port.
- API unhealthy: check MySQL health first, then API logs. The API retries initial database connection and automatically applies checked-in migrations.
- UI shows an action error: leave the state unchanged, read the actionable alert, and inspect API logs by request ID.
- Stale demo state: use **Reset demo**; do not delete the volume merely to reset workflow data.

## Release and rollback

GitHub Actions must pass lint, builds, API unit/integration tests, Angular browser tests, dependency audit, secret scan, and both container builds. For this local demo, rollback means checking out the last known-good commit and rebuilding Compose images. No hosted release, database backup schedule, or automated recovery objective exists; those are required before production use.

## Escalation boundary

Do not enter real student, employee, medical, payment, or university operational data. Stop and design production identity, encrypted secret management, backups, monitoring, and incident ownership before exposing the service publicly.
