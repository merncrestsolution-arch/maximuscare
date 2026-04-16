#!/usr/bin/env bash
set -euo pipefail

# Rollback to the previous release on Lightsail.
# Usage:
#   APP_ROOT=/opt/maximus-care APP_NAME=maximus-care SERVICE_NAME=maximus-care bash script/lightsail-rollback.sh

APP_NAME="${APP_NAME:-maximus-care}"
APP_ROOT="${APP_ROOT:-/opt/${APP_NAME}}"
RELEASES_DIR="${APP_ROOT}/releases"
CURRENT_LINK="${APP_ROOT}/current"
SERVICE_NAME="${SERVICE_NAME:-$APP_NAME}"

if [[ ! -d "$RELEASES_DIR" ]]; then
  echo "ERROR: releases directory not found: $RELEASES_DIR"
  exit 1
fi

mapfile -t releases < <(ls -1dt "${RELEASES_DIR}"/* 2>/dev/null || true)

if [[ "${#releases[@]}" -lt 2 ]]; then
  echo "ERROR: Need at least 2 releases to rollback."
  exit 1
fi

target="${releases[1]}"
ln -sfn "$target" "$CURRENT_LINK"

if command -v pm2 >/dev/null 2>&1 && pm2 jlist 2>/dev/null | grep -q "\"name\":\"${APP_NAME}\""; then
  pm2 restart "$APP_NAME" --update-env
  pm2 save
  echo "Rolled back using pm2 to: $target"
  exit 0
fi

if command -v systemctl >/dev/null 2>&1 && systemctl list-unit-files 2>/dev/null | grep -q "^${SERVICE_NAME}\.service"; then
  systemctl restart "${SERVICE_NAME}.service"
  echo "Rolled back using systemd service ${SERVICE_NAME}.service to: $target"
  exit 0
fi

if command -v docker >/dev/null 2>&1; then
  cd "$CURRENT_LINK"
  if [[ -f docker-compose.yml ]]; then
    docker compose -f docker-compose.yml up -d --build
    echo "Rolled back using docker compose (docker-compose.yml) to: $target"
    exit 0
  fi
  if [[ -f compose.yml ]]; then
    docker compose -f compose.yml up -d --build
    echo "Rolled back using docker compose (compose.yml) to: $target"
    exit 0
  fi
fi

echo "Rollback switched symlink, but no known process manager was restarted."
echo "Current target: $target"
