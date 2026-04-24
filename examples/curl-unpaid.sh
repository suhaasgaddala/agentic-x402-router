#!/usr/bin/env sh
set -eu

curl -sS -X POST "${BASE_URL:-http://localhost:3000}/v1/model-call" \
  -H "content-type: application/json" \
  --data @examples/sample-model-call.json
