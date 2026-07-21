<p align="center">
  <img src="apps/web/public/assets/big-red-marching-band-logo.png" alt="Cornell Big Red Marching Band" width="680">
</p>

<h1 align="center">Bandboard</h1>

<p align="center">
  An enterprise-shaped operations platform for the controlled chaos of a collegiate marching band.
</p>

<p align="center">
  <a href="https://d1vlahcgbfcf5u.cloudfront.net"><strong>Launch the live AWS demo</strong></a>
  ·
  <a href="docs/ARCHITECTURE.md">Architecture</a>
  ·
  <a href="docs/RUNBOOK.md">Runbook</a>
  ·
  <a href="docs/FINISHER_REPORT.md">Readiness report</a>
</p>

<p align="center">
  <img src="https://github.com/capo689/Cornell/actions/workflows/ci.yml/badge.svg" alt="CI status">
  <img src="https://img.shields.io/badge/AWS-live-232F3E?logo=amazonwebservices" alt="AWS live">
  <img src="https://img.shields.io/badge/demo_data-synthetic-2F855A" alt="Synthetic data">
</p>

Bandboard turns one understandable operational problem into a full-stack systems demonstration. A tenor sax player becomes unavailable shortly before a fictional Homecoming performance. The coordinator must find a qualified substitute, resolve the travel conflict, publish a new event revision, generate an offline packet, notify members, and prove that the change was acknowledged.

That single story crosses the browser, API, relational database, transaction boundary, durable queue, independent worker, private object storage, generated PDF, audit trail, monitoring, recovery path, and deployment pipeline.

> This is a public portfolio demonstration built entirely with synthetic people, events, assignments, and documents. It is not affiliated with or endorsed by Cornell University.

## What you can do

### Coordinator experience

- Start from a deliberately broken **82% readiness** state with three visible blockers.
- Assign the best qualified substitute and resolve music, equipment, and transportation constraints in one transaction.
- Change member availability, reorder repertoire, and report equipment damage.
- Publish revision 4 and watch three durable jobs move through queued, processing, and complete states.
- Inspect operational history, job attempts, actor-attributed audit events, and packet metadata.
- Download a real one-page event packet through a five-minute signed S3 URL.
- Trigger a controlled worker failure, observe three delivery attempts and DLQ redrive, then replay the same durable job.
- Reset every mutation back to the canonical 82% opening state.

### Member experience

- Switch perspectives instantly without juggling demo credentials.
- See a focused itinerary, assignment, equipment, and “bring with you” view.
- Review the newly generated packet and acknowledge the published revision.
- See the acknowledgment reflected in coordinator readiness.

### Live integration

Weather for Schoellkopf Field comes from Open-Meteo through the NestJS API—not directly from the browser. The adapter normalizes the provider response, caches it for ten minutes, applies a short timeout, and returns an explicit fallback state if the upstream service is unavailable.

## Five-minute reviewer script

1. Open the [live demo](https://d1vlahcgbfcf5u.cloudfront.net) and inspect the 82% readiness ring and three blockers.
2. Select **Assign** for Alex Rivera. Confirm that coverage and travel resolve together.
3. Select **Publish revision**. Open **Operations** and watch packet generation, notification, and readiness jobs complete asynchronously.
4. Download the packet and confirm it is a generated PDF—not a static fixture.
5. Switch to **Member**, acknowledge revision 4, then return to **Coordinator** to see the state change.
6. Under **Operations**, run the recovery drill. Watch attempts 1–3 fail, then use **Retry** to replay the durable job successfully.
7. Select **Reset demo** to restore the opening case.

For a deeper pass, use **People**, **Repertoire**, and **Equipment** to mutate data and verify that the audit trail records each action.

## Architecture

```mermaid
flowchart LR
  U["Reviewer browser"] --> CF["CloudFront HTTPS edge"]
  CF -->|"Static Angular assets"| WEB["Private S3 web bucket"]
  CF -->|"/api/*"| ALB["Application Load Balancer"]
  ALB --> API["NestJS API on ECS Fargate"]
  API --> DB[("Private RDS MySQL")]
  API -->|"Durable job ID"| Q["SQS work queue"]
  Q --> WORKER["Independent ECS worker"]
  Q -->|"3 failed receives"| DLQ["SQS dead-letter queue"]
  WORKER --> DB
  WORKER -->|"Generated PDF"| PACKETS["Private S3 packet bucket"]
  API -->|"5-minute signed URL"| PACKETS
  API --> WEATHER["Open-Meteo"]
  API --> LOGS["CloudWatch logs and alarms"]
  WORKER --> LOGS
```

CloudFront is the only public application entry point. Static assets come from a private origin-access-controlled S3 bucket. `/api/*` requests pass through an ALB whose security group admits only the AWS-managed CloudFront origin-facing prefix list. RDS is non-public. API and worker use separate least-privilege task roles.

The local environment preserves the same application contracts with Nginx, MySQL, and LocalStack, so CI exercises the S3/SQS behavior without cloud credentials.

## The stack

| Layer | Technology | What it demonstrates |
| --- | --- | --- |
| Frontend | Angular 20, Angular Material, SCSS | Responsive coordinator/member UX, accessibility semantics, loading/error states |
| API | NestJS, Swagger/OpenAPI, class-validator | REST design, DTO validation, role guard, throttling, health checks, request IDs |
| Data | MySQL 8.4, TypeORM | Checked-in migrations, relationships, transactions, audit history; synchronization disabled |
| Async work | Amazon SQS, separate Nest worker | Durable jobs, idempotency, three-attempt retry, DLQ redrive, operator replay |
| Documents | PDFKit | Generated offline event packet with revision and integrity metadata |
| Storage | Private Amazon S3 | Encrypted objects, deterministic keys, SHA-256 checksum, signed downloads |
| Cloud | CloudFront, ALB, ARM64 ECS Fargate, RDS, S3, SQS, Secrets Manager | Managed HTTPS deployment with private state and independently deployed compute |
| Operations | CloudWatch, AWS Budgets | Central logs, queue-age/DLQ/unhealthy-target alarms, monthly cost tracking |
| Delivery | CloudFormation, ECR, GitHub Actions OIDC | Repeatable infrastructure, immutable images, no stored AWS keys, circuit-breaker rollback |
| Local/CI | Docker Compose, Nginx, LocalStack, GitHub Actions | Production-shaped local environment and end-to-end infrastructure-contract testing |

## Testing the system

### One-command local system test

Requirements: Docker Desktop with Compose.

```bash
docker compose up --build -d
./scripts/verify-async-workflow.sh
```

Open <http://localhost:8080>. The verification script proves:

- API and worker health
- substitute assignment and publication
- three asynchronous jobs completing
- real PDF generation
- private S3-compatible storage and signed retrieval
- three worker failures and a new DLQ arrival
- operator replay of the same durable job

Stop and remove the disposable local data with:

```bash
docker compose down -v
```

### Code-level gates

```bash
npm ci
npm run lint
npm run build
npm test
npm run test:e2e --workspace api -- --runInBand
npm audit --audit-level=high
```

| Gate | Coverage |
| --- | --- |
| API unit tests | Business rules, weather normalization/fallback, PDF structure, worker success/failure behavior |
| API e2e tests | Health, validation, coordinator-only mutation, unresolved publish rejection |
| Angular browser tests | Coordinator/member rendering and interaction contracts in headless Chrome |
| Compose integration | MySQL migration, LocalStack S3/SQS, worker, signed PDF, DLQ, replay |
| Secret scan | Full-history Gitleaks scan |
| Dependency gate | Fails CI on high or critical audit findings |

The same gates run on every pull request in `.github/workflows/ci.yml`.

### Live AWS proof

With the configured AWS CLI profile:

```bash
AWS_PROFILE=bandboard-deploy AWS_REGION=us-east-1 ./scripts/aws-status.sh
AWS_PROFILE=bandboard-deploy AWS_REGION=us-east-1 ./scripts/verify-aws-workflow.sh
```

The remote script executes the complete workflow against CloudFront, RDS, SQS, the independent Fargate worker, and private S3. It verifies the downloaded PDF signature, observes a real DLQ increase, replays the job, then resets demo state and purges the synthetic drill message.

## Running in development

```bash
npm install
docker compose up mysql
npm run dev:api
npm run dev:web
```

- Angular development server: <http://localhost:4200>
- NestJS API: <http://localhost:3000/api/demo>
- Swagger UI: <http://localhost:3000/api/docs>

The Angular server proxies `/api` to NestJS. The API runs checked-in migrations; the worker intentionally does not, preventing concurrent migration ownership.

## Deployment and rollback

Initial AWS deployment:

```bash
AWS_PROFILE=bandboard-deploy AWS_REGION=us-east-1 ./scripts/deploy-aws.sh
```

CloudFormation creates the registry, GitHub OIDC provider, budget, private buckets, SQS/DLQ, RDS, ALB, CloudFront distribution, task roles, ECS services, logs, and alarms. The deployment script builds an immutable ARM64 image, publishes Angular assets with explicit cache policies, and waits for the public health endpoint.

After bootstrap, merges to `main` deploy through short-lived GitHub OIDC credentials. ECS deployment circuit breakers automatically roll back unhealthy revisions. An operator can also manually run **Deploy Bandboard** with a known-good ECR image tag for an explicit application rollback.

See [AWS deployment and operations](docs/AWS_DEPLOYMENT.md) for commands, cost boundaries, logs, and limitations.

## Security and scope decisions

- All repository and live-demo data is synthetic.
- The role switcher is intentionally frictionless for reviewers. It demonstrates the authorization seam but is **not authentication**.
- Coordinator mutations are still enforced by a NestJS guard; hiding a button is never treated as authorization.
- RDS is non-public, packet objects are private, and database credentials are managed by Secrets Manager.
- Browser responses receive security headers; API requests receive validation, throttling, CORS policy, and request IDs.
- GitHub Actions assumes a repository- and branch-scoped AWS role. No long-lived AWS credential is stored in GitHub.

Before real operational use, add institutional OIDC, server-derived actor claims, privacy/retention governance, verified alarm ownership, WAF/distributed rate limiting, restore exercises, and an incident process. The explicit boundary and scored gaps are documented in the [FINISHER report](docs/FINISHER_REPORT.md).

## Repository map

```text
apps/web/                 Angular coordinator and member application
apps/api/                 NestJS API, worker, entities, migrations, tests
infra/aws/                CloudFormation bootstrap and application stacks
infra/localstack/         Local S3/SQS/DLQ initialization
scripts/                  Local and AWS deploy/status/workflow proofs
.github/workflows/        CI plus OIDC deployment and rollback
docs/                     Architecture, runbook, ADR, deployment, readiness
docker-compose.yml        Complete local production-shaped environment
```

## Design note

The visual system and supplied event artwork establish a Big Red portfolio concept. They are used only for this synthetic demonstration and do not imply university affiliation, sponsorship, or endorsement.
