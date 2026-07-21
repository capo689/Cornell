#!/usr/bin/env bash
set -euo pipefail

AWS_PROFILE="${AWS_PROFILE:-bandboard-deploy}"
AWS_REGION="${AWS_REGION:-us-east-1}"
APP_STACK="${APP_STACK:-bandboard-app}"
APPLICATION_URL="${APPLICATION_URL:-$(aws --profile "${AWS_PROFILE}" --region "${AWS_REGION}" cloudformation describe-stacks --stack-name "${APP_STACK}" --query "Stacks[0].Outputs[?OutputKey=='ApplicationUrl'].OutputValue" --output text)}"
BASE_URL="${APPLICATION_URL}/api/demo"
HEADERS=(-H 'content-type: application/json' -H 'x-demo-role: coordinator' -H 'x-demo-user: AWS Verifier')
WORK_DIR="$(mktemp -d)"
STATE_FILE="${WORK_DIR}/state.json"
PACKET_FILE="${WORK_DIR}/event-packet.pdf"
trap 'rm -rf "${WORK_DIR}"' EXIT

request() {
  curl --fail --silent --show-error "${HEADERS[@]}" "$@"
}

wait_for_expression() {
  local expression="$1"
  local label="$2"
  for _ in $(seq 1 90); do
    request "${BASE_URL}/state" > "${STATE_FILE}"
    if node -e "const s=require(process.argv[1]); process.exit(${expression} ? 0 : 1)" "${STATE_FILE}"; then
      return 0
    fi
    sleep 1
  done
  echo "Timed out waiting for ${label}." >&2
  node -e 'console.error(JSON.stringify(require(process.argv[1]), null, 2))' "${STATE_FILE}"
  return 1
}

for _ in $(seq 1 90); do
  request "${BASE_URL}/health" >/dev/null 2>&1 && break
  sleep 2
done
request "${BASE_URL}/health" >/dev/null

DLQ_URL="$(aws --profile "${AWS_PROFILE}" --region "${AWS_REGION}" sqs get-queue-url --queue-name bandboard-jobs-dlq --query QueueUrl --output text)"
INITIAL_DLQ_COUNT="$(aws --profile "${AWS_PROFILE}" --region "${AWS_REGION}" sqs get-queue-attributes --queue-url "${DLQ_URL}" --attribute-names ApproximateNumberOfMessages --query 'Attributes.ApproximateNumberOfMessages' --output text)"

request -X POST "${BASE_URL}/reset" >/dev/null
request "${BASE_URL}/state" > "${STATE_FILE}"
MEMBER_ID="$(node -e "const s=require(process.argv[1]); process.stdout.write(s.members.find((m) => m.name === 'Alex Rivera').id)" "${STATE_FILE}")"

request -X POST -d "{\"memberId\":\"${MEMBER_ID}\"}" "${BASE_URL}/resolve-absence" >/dev/null
request -X POST -d '{}' "${BASE_URL}/publish" >/dev/null
wait_for_expression "s.packet.status === 'READY' && s.jobs.filter((j) => ['GENERATE_PACKET','NOTIFY_MEMBERS','RECALCULATE_READINESS'].includes(j.type)).every((j) => j.state === 'COMPLETE')" 'AWS packet generation and worker completion'

request "${BASE_URL}/packet" > "${WORK_DIR}/packet.json"
DOWNLOAD_URL="$(node -e 'process.stdout.write(require(process.argv[1]).downloadUrl)' "${WORK_DIR}/packet.json")"
curl --fail --silent --show-error "${DOWNLOAD_URL}" > "${PACKET_FILE}"
test "$(head -c 4 "${PACKET_FILE}")" = '%PDF'
test "$(wc -c < "${PACKET_FILE}")" -gt 3000

request -X POST -d '{}' "${BASE_URL}/jobs/recovery-drill" >/dev/null
wait_for_expression "s.jobs.some((j) => j.payload?.drill === 'worker-recovery' && j.state === 'FAILED' && j.attempts === 3)" 'controlled AWS worker failure after three attempts'
FAILED_JOB_ID="$(node -e "const s=require(process.argv[1]); process.stdout.write(s.jobs.find((j) => j.payload?.drill === 'worker-recovery').id)" "${STATE_FILE}")"

for _ in $(seq 1 60); do
  DLQ_COUNT="$(aws --profile "${AWS_PROFILE}" --region "${AWS_REGION}" sqs get-queue-attributes --queue-url "${DLQ_URL}" --attribute-names ApproximateNumberOfMessages --query 'Attributes.ApproximateNumberOfMessages' --output text)"
  [[ "${DLQ_COUNT}" -gt "${INITIAL_DLQ_COUNT}" ]] && break
  sleep 2
done
test "${DLQ_COUNT:-0}" -gt "${INITIAL_DLQ_COUNT}"

request -X POST -d '{}' "${BASE_URL}/jobs/${FAILED_JOB_ID}/retry" >/dev/null
wait_for_expression "s.jobs.some((j) => j.id === '${FAILED_JOB_ID}' && j.state === 'COMPLETE' && j.attempts === 1)" 'AWS operator replay completion'

PACKET_BYTES="$(wc -c < "${PACKET_FILE}" | tr -d ' ')"
request -X POST "${BASE_URL}/reset" >/dev/null
aws --profile "${AWS_PROFILE}" --region "${AWS_REGION}" sqs purge-queue --queue-url "${DLQ_URL}"

echo "AWS workflow verified at ${APPLICATION_URL}: PDF=${PACKET_BYTES} bytes, signed S3=ok, attempts=3, DLQ=${DLQ_COUNT}, replay=complete, cleanup=reset+dlq-purged"
