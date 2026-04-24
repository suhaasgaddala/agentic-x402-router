#!/usr/bin/env sh
set -eu

curl -sS "${BASE_URL:-http://localhost:3000}/health"
