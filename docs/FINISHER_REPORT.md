# FINISHER production-readiness report

## Executive summary

**Launch recommendation:** ready for a hosted synthetic-data portfolio demonstration; do not use real university data or treat the demo role switcher as identity.

Bandboard has a coherent, testable golden path; real database persistence and migrations; server-owned business rules; input validation; role-boundary demonstration; rate limiting; audit and job visibility; a live, server-cached weather integration; responsive error/loading states; structured request logs; container builds; and CI gates. Its long-running path is not architectural scaffolding: a separate ECS worker consumes SQS messages, generates a real PDF, stores it in private S3, and exposes a short-lived signed download. A controlled live-AWS drill proves three attempts, DLQ redrive, visible failure state, and operator replay.

Overall readiness is **96/100 for the hosted portfolio scope** and **70/100 for a real production service**. The difference is intentional: real identity, institutional authorization, tested database restore, named alert ownership, privacy governance, and operational support are outside this demo.

## P0/P1/P2 risk table

| Priority             | Risk                                                                                | Current control                                                                                           | Required remediation                                                                                                          |
| -------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| P0 for real use      | Demo headers are forgeable and are not authentication                               | Synthetic-only scope, explicit UI label, server guard demonstrates the seam                               | Integrate OIDC, validate tokens, derive actor/roles server-side, and test token expiry plus cross-role access                 |
| P0 for real data     | No approved privacy, retention, backup, or recovery controls                        | Repository and UI use fictional data only                                                                 | Classify data, minimize fields, encrypt managed storage, document retention/deletion, prove backup restore                    |
| P1                   | No named operational owner or alert recipient                                       | CloudWatch logs; API health; queue-age, DLQ, and unhealthy-target alarms all verified `OK`                 | Add a verified notification target, exception aggregation, escalation policy, and named owner                                 |
| P1                   | Backup exists but restore objective is unproved                                     | Encrypted RDS, one-day automated backups, deletion snapshot policy                                        | Exercise restore, measure RPO/RTO, and document acceptance                                                                     |
| P2                   | Rate limit is single-process and uniform                                            | 100 requests/minute in-process guard                                                                      | Use distributed limiting and route/cost-specific budgets if scaled horizontally                                               |
| P2                   | Accessibility was manually checked but not fully automated                          | Semantic interface, keyboard focus, responsive browser QA                                                 | Add automated axe checks and screen-reader acceptance testing                                                                 |
| P2                   | Audit reports three moderate development-tool findings through Angular CLI/MCP/Hono | No high or critical findings; vulnerable static-serving path is not used by the shipped Linux Nginx image | Reassess after a non-breaking Angular CLI fix is available; do not force a major downgrade/upgrade without regression testing |

No P0 blocks the explicitly scoped hosted synthetic-data demo. The first two rows become blockers the moment scope changes to real or trusted operational data.

## 13-layer scorecard

| Layer                              | Level 0 score | Evidence and gap                                                                                                                                              |
| ---------------------------------- | ------------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Frontend foundations            |          9/10 | Responsive coordinator/member UI, accessible labels/focus, disabled/loading/error states, API-backed sections; automated a11y scan remains                    |
| 2. APIs and backend logic          |          9/10 | DTO validation, Swagger, idempotent publish, transaction, queued long-running work, server-owned rules, cached Open-Meteo adapter, negative tests             |
| 3. Database and storage            |          9/10 | MySQL source of truth, checked-in migrations, synchronization disabled, deterministic packet keys, private S3 objects with checksums; no backup restore proof |
| 4. Auth and permissions            |          5/10 | Server guard rejects member mutation, but deliberately forgeable demo headers are not identity                                                                |
| 5. Hosting and deployment          |          9/10 | CloudFront HTTPS, immutable ECR images, ECS circuit-breaker rollback, stability wait, smoke test, and manual image rollback                                   |
| 6. Cloud and compute               |          9/10 | ARM64 API/worker services, private RDS and S3, SQS/DLQ, least-privilege task roles, and live workflow proof                                                    |
| 7. CI/CD and version control       |          9/10 | PR quality gates plus branch-scoped GitHub OIDC deployment with no long-lived AWS key                                                                         |
| 8. Security and data protection    |          8/10 | Synthetic data, managed DB secret, encrypted private storage, CloudFront-only ALB ingress, security headers; no OIDC/WAF/privacy program                     |
| 9. Rate limiting and cost controls |          8/10 | Global in-process limiter; no paid API or AI feature; distributed policy unnecessary at Level 0                                                               |
| 10. Caching and CDN                |          9/10 | CloudFront static caching, immutable asset policy, uncached API behavior, private OAC S3 origin                                                                |
| 11. Load balancing and scaling     |          8/10 | ALB health checks, stateless API, separate worker, external state seams, circuit breaker; no load test or autoscaling                                          |
| 12. Error tracking and logs        |          9/10 | CloudWatch API/worker logs, structured request IDs, audit trail, three infrastructure alarms; no exception aggregator or recipient                            |
| 13. Availability and recovery      |          9/10 | Managed health checks, automatic RDS backup, deterministic reset, DLQ/replay proof, deployment rollback; no restore drill or SLO                               |

## Remediation plan

### Before real operational use

1. Add institutional OIDC and immutable server-derived actor/role claims.
2. Add a verified alarm recipient, exception aggregation, uptime monitor, and incident owner.
3. Exercise database restore and document measured RPO/RTO.
4. Complete privacy/retention review, authorization tests, capacity testing, distributed rate limiting, security review, accessibility acceptance, and operational support procedures.

## Verification performed

- API lint and production builds
- Ten API unit tests, including PDF structure and worker processing/failure behavior
- Full-stack browser golden path: 82% → substitute assignment → publish → member acknowledgment → 100%
- Operations browser path: controlled worker failure → visible failed state → operator retry → completion; console clean
- Negative paths: publish before coverage and member mutation rejection
- Desktop and 390×844 responsive visual checks
- Rendered the signed S3 packet with Poppler; confirmed one-page Letter output and visually inspected the final artifact
- Docker Compose/LocalStack integration: real PDF, signed S3 retrieval, three SQS receives, new DLQ message, successful replay
- AWS CloudFormation `CREATE_COMPLETE`; API and worker each one desired/running task with completed rollouts; all three alarms `OK`
- Live CloudFront proof: real PDF, signed private-S3 retrieval, three SQS receives, one DLQ arrival, and successful replay
- Live coordinator/member visual QA at the CloudFront URL: supplied logos and hero imagery, correct 82% readiness ring, live weather, and zero browser warnings/errors
- Startup-log review caught and corrected concurrent migration ownership; only the API now runs schema migrations
- Dependency audit: 0 critical/high, 3 moderate development-tool findings; CI high-severity gate and secret scan configured

Payments, AI cost controls, file uploads, real notifications, and data ownership across multiple accounts are not applicable to this Level 0 build because those capabilities are not present.
