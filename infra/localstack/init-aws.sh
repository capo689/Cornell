#!/usr/bin/env bash
set -euo pipefail

awslocal s3api head-bucket --bucket bandboard-packets 2>/dev/null || \
  awslocal s3api create-bucket --bucket bandboard-packets >/dev/null

DLQ_URL="$(awslocal sqs get-queue-url --queue-name bandboard-jobs-dlq --query QueueUrl --output text 2>/dev/null || true)"
if [[ -z "${DLQ_URL}" || "${DLQ_URL}" == "None" ]]; then
  DLQ_URL="$(awslocal sqs create-queue --queue-name bandboard-jobs-dlq --query QueueUrl --output text)"
fi
DLQ_ARN="$(awslocal sqs get-queue-attributes --queue-url "${DLQ_URL}" --attribute-names QueueArn --query 'Attributes.QueueArn' --output text)"
REDRIVE_POLICY="{\"deadLetterTargetArn\":\"${DLQ_ARN}\",\"maxReceiveCount\":\"3\"}"
ATTRIBUTES_FILE="/tmp/bandboard-queue-attributes.json"
printf '{"VisibilityTimeout":"8","ReceiveMessageWaitTimeSeconds":"2","RedrivePolicy":"%s"}\n' \
  "${REDRIVE_POLICY//\"/\\\"}" > "${ATTRIBUTES_FILE}"

QUEUE_URL="$(awslocal sqs get-queue-url --queue-name bandboard-jobs --query QueueUrl --output text 2>/dev/null || true)"
if [[ -z "${QUEUE_URL}" || "${QUEUE_URL}" == "None" ]]; then
  awslocal sqs create-queue \
    --queue-name bandboard-jobs \
    --attributes "file://${ATTRIBUTES_FILE}" \
    >/dev/null
else
  awslocal sqs set-queue-attributes \
    --queue-url "${QUEUE_URL}" \
    --attributes "file://${ATTRIBUTES_FILE}"
fi
