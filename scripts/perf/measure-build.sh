#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_ROOT=$(cd "$SCRIPT_DIR/../.." && pwd)
source "$SCRIPT_DIR/lib/metrics.sh"

perf_require_bun

label="current"
mode="both"
artifact_root="$SCRIPT_DIR/artifacts"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --label)
      label="$2"
      shift 2
      ;;
    --mode)
      mode="$2"
      shift 2
      ;;
    --artifact-root)
      artifact_root="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

if [[ "$mode" != "cold" && "$mode" != "warm" && "$mode" != "both" ]]; then
  echo "--mode must be one of: cold, warm, both" >&2
  exit 1
fi

artifact_dir="$artifact_root/$label"
perf_ensure_dir "$artifact_dir"
out_file="$artifact_dir/build-metrics.ndjson"
: > "$out_file"

record_stage() {
  local stage="$1"
  local command="$2"
  local run_mode="$3"

  if [[ "$run_mode" == "cold" && ( "$stage" == "full" || "$stage" == "editor" ) ]]; then
    rm -rf "$REPO_ROOT/editor/.next"
  fi

  echo "[measure-build] $run_mode:$stage -> $command"
  local timed
  timed=$(cd "$REPO_ROOT" && perf_run_timed_command bash -lc "$command")
  local elapsed_ms status
  elapsed_ms="${timed%,*}"
  status="${timed#*,}"

  local real_sec
  real_sec=$(awk -v ms="$elapsed_ms" 'BEGIN { printf "%.3f", ms / 1000 }')
  local timestamp
  timestamp=$(perf_iso8601)

  local json_line
  json_line=$(RUN_MODE="$run_mode" STAGE="$stage" CMD="$command" REAL_SEC="$real_sec" TS="$timestamp" STATUS="$status" bun -e '
    const status = Number(process.env.STATUS || "1");
    const payload = {
      command: process.env.CMD,
      stage: process.env.STAGE,
      mode: process.env.RUN_MODE,
      realSec: Number(process.env.REAL_SEC),
      timestamp: process.env.TS,
      status,
    };
    console.log(JSON.stringify(payload));
    if (status !== 0) process.exit(status);
  ')

  perf_append_json_line "$out_file" "$json_line"
}

commands=(
  "full|bun run build"
  "shared|bun run --filter '@magam/shared' build"
  "core|bun run --filter '@magam/core' build"
  "runtime|bun run --filter '@magam/runtime' build"
  "cli|bun run --filter '@magam/cli' build"
  "editor|bun run build:editor"
)

run_mode_block() {
  local run_mode="$1"
  for item in "${commands[@]}"; do
    local stage="${item%%|*}"
    local command="${item#*|}"
    record_stage "$stage" "$command" "$run_mode"
  done
}

if [[ "$mode" == "cold" || "$mode" == "both" ]]; then
  run_mode_block "cold"
fi

if [[ "$mode" == "warm" || "$mode" == "both" ]]; then
  run_mode_block "warm"
fi

echo "[measure-build] wrote $out_file"
