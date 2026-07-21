# Bandboard AWS deployment

## Deployed shape

The demo uses one public CloudFront URL. CloudFront serves the compiled Angular application from a private S3 bucket and forwards `/api/*` to an Application Load Balancer. The load balancer admits only the AWS-managed CloudFront origin-facing prefix list. Two independent ARM64 ECS Fargate services run the NestJS API and worker. RDS MySQL is non-public, packet objects remain in a second private S3 bucket, and SQS owns retry and dead-letter delivery.

CloudFormation in `infra/aws` also creates CloudWatch log groups and alarms for queue age, dead-letter arrivals, and unhealthy targets. RDS manages its own master secret in Secrets Manager. GitHub Actions receives short-lived AWS credentials through immutable repository-ID- and branch-scoped OIDC; the repository stores no AWS access key.

## Initial deployment

Requirements: Docker Desktop, Node.js, AWS CLI v2, and a non-root AWS CLI profile with bootstrap permissions.

```bash
AWS_PROFILE=bandboard-deploy AWS_REGION=us-east-1 ./scripts/deploy-aws.sh
AWS_PROFILE=bandboard-deploy AWS_REGION=us-east-1 ./scripts/aws-status.sh
AWS_PROFILE=bandboard-deploy AWS_REGION=us-east-1 ./scripts/verify-aws-workflow.sh
```

The deploy script is idempotent. It creates the immutable ECR repository and GitHub OIDC provider, pushes an ARM64 image tagged with the Git commit, discovers the default VPC's first two availability-zone subnets, deploys the application stack, uploads the frontend, and performs a public health check.

## Release and rollback

Merging to `main` runs `.github/workflows/deploy.yml`. A normal run builds an immutable commit-tagged image, registers API and worker task-definition revisions, relies on the ECS deployment circuit breaker for automatic rollback, publishes the frontend, and smoke-tests the public endpoint.

For an operator-selected rollback, run the **Deploy Bandboard** workflow manually and supply a previously published ECR `image_tag`. The workflow verifies that image before changing either ECS service. Database migrations must remain backward compatible with the prior image because application and schema rollback are deliberately separate controls.

## Operations

```bash
./scripts/aws-status.sh

aws --profile bandboard-deploy --region us-east-1 \
  logs tail /bandboard/api --since 30m

aws --profile bandboard-deploy --region us-east-1 \
  logs tail /bandboard/worker --since 30m
```

The full remote verification resets synthetic data, covers the missing part, publishes a revision, waits for all three asynchronous jobs, validates a signed private-S3 PDF, drives a controlled job through three failed deliveries into the DLQ, and successfully replays the same durable job.

## Cost and boundary

The stack is intentionally cost-conscious: one small API task, one small worker task, one `db.t4g.micro` instance, no NAT Gateway, modest log retention, and S3 lifecycle rules. Actual cost varies by use and region; the template creates a USD 75 monthly AWS Budget and emails `adam@agency689.com` at 80% actual spend or 100% forecasted spend.

This remains a public portfolio demo with synthetic data. Its role switcher is an explicit reviewability choice, not authentication. Before accepting real university data, add institutional OIDC, server-derived claims, WAF/rate-limit controls at the edge, tested restore objectives, privacy review, and an owned incident process.
