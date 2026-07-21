#!/usr/bin/env bash
set -euo pipefail

AWS_PROFILE="${AWS_PROFILE:-bandboard-deploy}"
AWS_REGION="${AWS_REGION:-us-east-1}"
APP_STACK="${APP_STACK:-bandboard-app}"

aws --profile "${AWS_PROFILE}" --region "${AWS_REGION}" cloudformation describe-stacks \
  --stack-name "${APP_STACK}" \
  --query 'Stacks[0].{Status:StackStatus,Url:Outputs[?OutputKey==`ApplicationUrl`]|[0].OutputValue}' \
  --output table
aws --profile "${AWS_PROFILE}" --region "${AWS_REGION}" ecs describe-services \
  --cluster bandboard \
  --services bandboard-api bandboard-worker \
  --query 'services[].{Service:serviceName,Desired:desiredCount,Running:runningCount,Pending:pendingCount,Rollout:deployments[0].rolloutState}' \
  --output table
aws --profile "${AWS_PROFILE}" --region "${AWS_REGION}" cloudwatch describe-alarms \
  --alarm-name-prefix bandboard- \
  --query 'MetricAlarms[].{Alarm:AlarmName,State:StateValue}' \
  --output table
