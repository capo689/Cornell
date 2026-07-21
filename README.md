# Bandboard

Bandboard is a deliberately compact enterprise demo for coordinating the controlled chaos of a fictional collegiate marching band. One seeded disruption travels through the complete system: a coordinator covers an unavailable tenor sax part, publishes a revised event plan, background jobs produce the member update, and a band member acknowledges the change.

The repository is public and uses only synthetic people, events, assignments, and documents. It is not affiliated with or endorsed by Cornell University.

## What the demo proves

- Angular 20 and Angular Material with responsive, keyboard-accessible coordinator and member experiences
- NestJS REST API with validation, security headers, CORS, role enforcement, and health checks
- MySQL 8 with TypeORM entities, relationships, transactions, and an audit trail
- SQS-compatible background-job adapter for packet generation, notifications, and readiness calculation
- Nginx reverse proxy and production Angular hosting
- Docker Compose local environment with separate web, API, and database services
- GitHub Actions builds, tests, dependency audit, and container verification
- AWS-ready boundaries for ECS, RDS, S3, SQS, and CloudWatch deployment

## Run the complete demo

Requirements: Docker Desktop with Compose.

```bash
docker compose up --build
```

Open <http://localhost:8080>. MySQL is initialized automatically and the API seeds the single fictional Homecoming event on first use.

The Compose environment enables TypeORM schema synchronization strictly for disposable local data. A hosted deployment should disable it and run reviewed migrations during release.

Use **View as member** in the header to switch between the two demo perspectives. The backend—not just the interface—rejects coordinator mutations from the member role.

## Run in development

```bash
npm install
docker compose up mysql
npm run dev:api
npm run dev:web
```

The Angular development server is at <http://localhost:4200> and proxies `/api` to NestJS on port 3000.

## Five-minute demonstration

1. Open the coordinator Command view and inspect the 82% event-readiness state.
2. Assign Alex Rivera to cover the unavailable tenor sax part.
3. Publish revision 4; inspect the job activity under Operations.
4. Switch to the member view and acknowledge the changed assignment.
5. Return to the coordinator view and observe the completed readiness state.

## Architecture

```text
Browser
  │
  ▼
Nginx ──► Angular
  │ /api
  ▼
NestJS ──► MySQL / RDS
  │
  ├──────► SQS ──► worker contract
  └──────► S3 document contract
```

When `SQS_QUEUE_URL` is absent, the local adapter records and completes jobs in MySQL so the demo has no cloud prerequisite. When configured, the same service sends durable messages through the AWS SDK. The future AWS deployment separates the API and worker into ECS services and replaces local MySQL with RDS.

## Security and accessibility notes

- Mutation authorization is enforced by a NestJS guard; hidden buttons are not treated as security.
- Helmet supplies baseline response headers and Nginx adds browser-facing policy headers.
- Uploaded-document functionality is represented architecturally but intentionally excluded from this thin demo until signed S3 URLs and file validation are implemented.
- The interface includes a skip link, visible focus states, non-color status text, responsive layouts, semantic headings, live alerts, and a list-based experience rather than an inaccessible canvas.
- Demo role headers illustrate the authorization boundary; a production deployment would validate OAuth/OIDC tokens and map claims to the same role guard.

## Original visual asset

`apps/web/public/assets/band-night-field.png` was generated specifically for this demo. It depicts a fictional ensemble and contains no university marks or logos.
