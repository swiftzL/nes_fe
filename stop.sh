#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="${ROOT_DIR}/.server.pid"

if [[ ! -f "${PID_FILE}" ]]; then
  echo "[stop.sh] 未找到 PID 文件 (${PID_FILE})，服务可能未运行。"
  exit 0
fi

SERVER_PID="$(cat "${PID_FILE}")"
if [[ -z "${SERVER_PID}" ]]; then
  echo "[stop.sh] PID 文件为空，无法停止服务。"
  rm -f "${PID_FILE}"
  exit 1
fi

if kill -0 "${SERVER_PID}" 2>/dev/null; then
  echo "[stop.sh] 正在停止服务 (PID: ${SERVER_PID}) ..."
  kill "${SERVER_PID}" 2>/dev/null || true
  for _ in {1..20}; do
    if kill -0 "${SERVER_PID}" 2>/dev/null; then
      sleep 0.5
    else
      break
    fi
  done

  if kill -0 "${SERVER_PID}" 2>/dev/null; then
    echo "[stop.sh] 进程未按时退出，发送 SIGKILL ..."
    kill -9 "${SERVER_PID}" 2>/dev/null || true
  fi
else
  echo "[stop.sh] PID ${SERVER_PID} 对应的进程不存在，直接清理 PID 文件。"
fi

rm -f "${PID_FILE}"
echo "[stop.sh] 服务已停止。"

