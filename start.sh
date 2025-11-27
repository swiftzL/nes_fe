#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="${ROOT_DIR}/.server.pid"
LOG_DIR="${ROOT_DIR}/logs"
LOG_FILE="${LOG_DIR}/server.log"
SERVER_ENTRY="${ROOT_DIR}/.output/server/index.mjs"

if [[ ! -f "${SERVER_ENTRY}" ]]; then
  echo "[start.sh] 未找到 ${SERVER_ENTRY}，请先运行 'npm run build'。" >&2
  exit 1
fi

if [[ -f "${PID_FILE}" ]]; then
  EXISTING_PID="$(cat "${PID_FILE}")"
  if [[ -n "${EXISTING_PID}" ]] && kill -0 "${EXISTING_PID}" 2>/dev/null; then
    echo "[start.sh] 服务已在运行 (PID: ${EXISTING_PID})。"
    exit 0
  fi
fi

mkdir -p "${LOG_DIR}"

export NODE_ENV="${NODE_ENV:-production}"
export HOST="${HOST:-0.0.0.0}"
export PORT="${PORT:-3000}"

echo "[start.sh] 启动服务 (HOST=${HOST}, PORT=${PORT}) ..."
bun run start >> "${LOG_FILE}" 2>&1 &
SERVER_PID=$!
echo "${SERVER_PID}" > "${PID_FILE}"
echo "[start.sh] 服务已启动，PID=${SERVER_PID}。日志：${LOG_FILE}"

