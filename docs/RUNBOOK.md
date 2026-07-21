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
5. Confirm the three publish jobs complete, the packet artifact says **Private S3 object**, and its Download action returns a PDF.
6. Run **Recovery drill**, wait for the third failed attempt, then use **Retry** and confirm the same job completes.

Use **Reset demo** to restore the opening state. API documentation is available at <http://localhost:8080/api/docs>.

## Health and logs

```bash
curl --fail http://localhost:8080/api/demo/health
docker compose ps
docker compose logs --tail=100 api
docker compose logs --tail=100 worker
docker compose logs --tail=100 localstack
docker compose logs --tail=100 mysql
docker compose logs --tail=100 web
```

API access logs are structured JSON and include method, path, status, duration, and request ID. A response's `x-request-id` can be matched to the API log. There is no hosted log aggregation or alerting in Level 0.

## Common failures

- `8080` already in use: stop the conflicting local process or change the host-side web port.
- API unhealthy: check MySQL health first, then API logs. The API retries initial database connection and automatically applies checked-in migrations.
- Packet remains in Generating: check `worker` logs, then confirm `bandboard-jobs` exists in LocalStack and the worker can reach S3.
- Job reaches Failed: read its safe error text in Operations, check the DLQ and worker logs, correct the cause, then replay with **Retry**.
- UI shows an action error: leave the state unchanged, read the actionable alert, and inspect API logs by request ID.
- Stale demo state: use **Reset demo**; do not delete the volume merely to reset workflow data.

## Release and rollback

GitHub Actions must pass lint, builds, API unit/integration tests, Angular browser tests, dependency audit, secret scan, and the Compose S3/SQS workflow. Run `./scripts/verify-async-workflow.sh` locally against the running stack for the same proof.

The AWS deployment workflow uses immutable commit-tagged ECR images, short-lived GitHub OIDC credentials, ECS deployment circuit breakers, service-stability waits, and a public smoke test. Manual dispatch with an existing image tag performs an operator-selected application rollback. Run `./scripts/verify-aws-workflow.sh` after a release for the managed S3/SQS recovery proof. Full commands and limitations are in [AWS deployment](AWS_DEPLOYMENT.md).

## Escalation boundary

Do not enter real student, employee, medical, payment, or university operational data. Stop and design production identity, encrypted secret management, backups, monitoring, and incident ownership before exposing the service publicly.
