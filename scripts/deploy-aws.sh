#!/usr/bin/env bash
set -euo pipefail

AWS_PROFILE="${AWS_PROFILE:-bandboard-deploy}"
AWS_REGION="${AWS_REGION:-us-east-1}"
BOOTSTRAP_STACK="${BOOTSTRAP_STACK:-bandboard-bootstrap}"
APP_STACK="${APP_STACK:-bandboard-app}"
IMAGE_TAG="${IMAGE_TAG:-$(git rev-parse --short=12 HEAD)}"

aws_cli() {
  aws --profile "${AWS_PROFILE}" --region "${AWS_REGION}" "$@"
}

CALLER_ARN="$(aws_cli sts get-caller-identity --query Arn --output text)"
if [[ "${CALLER_ARN}" == *:root ]]; then
  echo "Refusing to deploy with AWS root credentials." >&2
  exit 1
fi

echo "Deploying Bandboard as ${CALLER_ARN} in ${AWS_REGION}."
aws_cli cloudformation deploy \
  --stack-name "${BOOTSTRAP_STACK}" \
  --template-file infra/aws/bootstrap.yml \
  --no-fail-on-empty-changeset \
  --tags Project=Bandboard Environment=demo ManagedBy=CloudFormation

REPOSITORY_URI="$(aws_cli cloudformation describe-stacks \
  --stack-name "${BOOTSTRAP_STACK}" \
  --query "Stacks[0].Outputs[?OutputKey=='ApiRepositoryUri'].OutputValue" \
  --output text)"
IMAGE_URI="${REPOSITORY_URI}:${IMAGE_TAG}"

if ! aws_cli ecr describe-images \
  --repository-name bandboard-api \
  --image-ids imageTag="${IMAGE_TAG}" >/dev/null 2>&1; then
  aws_cli ecr get-login-password | docker login \
    --username AWS \
    --password-stdin "${REPOSITORY_URI%/*}"
  docker build --platform linux/arm64 -f apps/api/Dockerfile -t "${IMAGE_URI}" .
  docker push "${IMAGE_URI}"
else
  echo "Reusing existing immutable image ${IMAGE_URI}."
fi

VPC_ID="$(aws_cli ec2 describe-vpcs \
  --filters Name=is-default,Values=true \
  --query 'Vpcs[0].VpcId' \
  --output text)"
if [[ -z "${VPC_ID}" || "${VPC_ID}" == "None" ]]; then
  echo "The deployment requires a default VPC or explicit script extension." >&2
  exit 1
fi

SUBNET_IDS="$(aws_cli ec2 describe-subnets \
  --filters Name=vpc-id,Values="${VPC_ID}" Name=default-for-az,Values=true \
  --query 'Subnets | sort_by(@, &AvailabilityZone)[:2].SubnetId' \
  --output text | tr '\t' ',')"
if [[ "${SUBNET_IDS}" != *,* ]]; then
  echo "At least two default subnets in distinct availability zones are required." >&2
  exit 1
fi

CLOUDFRONT_PREFIX_LIST_ID="$(aws_cli ec2 describe-managed-prefix-lists \
  --filters Name=prefix-list-name,Values=com.amazonaws.global.cloudfront.origin-facing \
  --query 'PrefixLists[0].PrefixListId' \
  --output text)"

aws_cli cloudformation deploy \
  --stack-name "${APP_STACK}" \
  --template-file infra/aws/app.yml \
  --capabilities CAPABILITY_NAMED_IAM \
  --no-fail-on-empty-changeset \
  --parameter-overrides \
    ApiImageUri="${IMAGE_URI}" \
    VpcId="${VPC_ID}" \
    SubnetIds="${SUBNET_IDS}" \
    CloudFrontPrefixListId="${CLOUDFRONT_PREFIX_LIST_ID}" \
    MonthlyBudgetUsd=75 \
  --tags Project=Bandboard Environment=demo ManagedBy=CloudFormation

WEB_BUCKET="$(aws_cli cloudformation describe-stacks \
  --stack-name "${APP_STACK}" \
  --query "Stacks[0].Outputs[?OutputKey=='WebBucketName'].OutputValue" \
  --output text)"
DISTRIBUTION_ID="$(aws_cli cloudformation describe-stacks \
  --stack-name "${APP_STACK}" \
  --query "Stacks[0].Outputs[?OutputKey=='DistributionId'].OutputValue" \
  --output text)"
APPLICATION_URL="$(aws_cli cloudformation describe-stacks \
  --stack-name "${APP_STACK}" \
  --query "Stacks[0].Outputs[?OutputKey=='ApplicationUrl'].OutputValue" \
  --output text)"

npm run build --workspace web
aws_cli s3 sync apps/web/dist/web/browser "s3://${WEB_BUCKET}" \
  --delete \
  --exclude index.html \
  --cache-control 'public,max-age=31536000,immutable'
aws_cli s3 cp apps/web/dist/web/browser/index.html "s3://${WEB_BUCKET}/index.html" \
  --content-type text/html \
  --cache-control 'no-cache,no-store,must-revalidate'
aws_cli cloudfront create-invalidation \
  --distribution-id "${DISTRIBUTION_ID}" \
  --paths '/*' >/dev/null

echo "Waiting for the public health endpoint at ${APPLICATION_URL}."
for _ in $(seq 1 90); do
  if curl --fail --silent --show-error "${APPLICATION_URL}/api/demo/health" >/dev/null 2>&1; then
    echo "Bandboard is healthy: ${APPLICATION_URL}"
    exit 0
  fi
  sleep 5
done

echo "Timed out waiting for ${APPLICATION_URL}/api/demo/health." >&2
exit 1
