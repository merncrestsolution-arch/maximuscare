#!/usr/bin/env bash
set -euo pipefail

# Safe deployment for Lightsail with release folders + rollback support.
# Run this script on the Lightsail instance.

APP_NAME="${APP_NAME:-maximus-care}"
APP_ROOT="${APP_ROOT:-/opt/${APP_NAME}}"
RELEASES_DIR="${APP_ROOT}/releases"
BACKUPS_DIR="${APP_ROOT}/backups"
CURRENT_LINK="${APP_ROOT}/current"
BRANCH="${BRANCH:-main}"
REPO_URL="${REPO_URL:-}"
PORT="${PORT:-3000}"
RUN_MIGRATIONS="${RUN_MIGRATIONS:-false}"
SERVICE_NAME="${SERVICE_NAME:-$APP_NAME}"

if [[ -z "$REPO_URL" ]]; then
  echo "ERROR: REPO_URL is required"
  echo "Example: REPO_URL='https://github.com/you/repo.git' BRANCH='main' bash script/lightsail-safe-update.sh"
  exit 1
fi

timestamp="$(date +%Y%m%d_%H%M%S)"
new_release="${RELEASES_DIR}/${timestamp}"
backup_path="${BACKUPS_DIR}/${timestamp}"
runtime="unknown"
previous_release=""

mkdir -p "$RELEASES_DIR" "$BACKUPS_DIR" "$backup_path"

if [[ -L "$CURRENT_LINK" ]]; then
  previous_release="$(readlink -f "$CURRENT_LINK")"
fi

detect_runtime() {
  if command -v docker >/dev/null 2>&1; then
    if [[ -n "$previous_release" ]] && [[ -f "${previous_release}/docker-compose.yml" || -f "${previous_release}/compose.yml" ]]; then
      runtime="docker-compose"
      return
    fi
  fi

  if command -v pm2 >/dev/null 2>&1; then
    if pm2 jlist 2>/dev/null | grep -q "\"name\":\"${APP_NAME}\""; then
      runtime="pm2"
      return
    fi
  fi

  if command -v systemctl >/dev/null 2>&1; then
    if systemctl list-unit-files 2>/dev/null | grep -q "^${SERVICE_NAME}\.service"; then
      runtime="systemd"
      return
    fi
  fi

  runtime="node"
}

backup_previous_release() {
  if [[ -n "$previous_release" ]] && [[ -d "$previous_release" ]]; then
    tar -czf "${backup_path}/release.tgz" -C "$previous_release" .
    if [[ -f "${previous_release}/.env" ]]; then
      cp "${previous_release}/.env" "${backup_path}/env.backup"
    fi
  fi
}

backup_database() {
  local env_file=""
  local db_url=""

  if [[ -n "$previous_release" ]] && [[ -f "${previous_release}/.env" ]]; then
    env_file="${previous_release}/.env"
    db_url="$(grep -E '^DATABASE_URL=' "$env_file" | sed 's/^DATABASE_URL=//' || true)"
  fi

  if [[ -z "$db_url" ]]; then
    if [[ -n "$previous_release" ]] && [[ -f "${previous_release}/data/maximus.db" ]]; then
      mkdir -p "${backup_path}/db"
      cp "${previous_release}/data/maximus.db" "${backup_path}/db/maximus.db"
    fi
    return
  fi

  if [[ "$db_url" == postgresql://* || "$db_url" == postgres://* ]]; then
    if command -v pg_dump >/dev/null 2>&1; then
      pg_dump "$db_url" > "${backup_path}/db-postgres.sql"
    else
      echo "WARN: pg_dump not found; postgres backup skipped"
    fi
  elif [[ "$db_url" == mysql://* || "$db_url" == mariadb://* ]]; then
    echo "WARN: MySQL URL detected. Run mysqldump manually before deploy."
  else
    local sqlite_path="${db_url#file:}"
    if [[ "$sqlite_path" != /* ]] && [[ -n "$previous_release" ]]; then
      sqlite_path="${previous_release}/${sqlite_path#./}"
    fi
    if [[ -f "$sqlite_path" ]]; then
      mkdir -p "${backup_path}/db"
      cp "$sqlite_path" "${backup_path}/db/$(basename "$sqlite_path")"
    fi
  fi
}

prepare_release() {
  git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$new_release"
  cd "$new_release"

  if [[ -n "$previous_release" ]] && [[ -f "${previous_release}/.env" ]]; then
    cp "${previous_release}/.env" "${new_release}/.env"
  fi

  npm ci
  npm run build
  npm prune --omit=dev

  if [[ "$RUN_MIGRATIONS" == "true" ]]; then
    npm run db:push
  fi
}

switch_release_and_restart() {
  ln -sfn "$new_release" "$CURRENT_LINK"

  case "$runtime" in
    docker-compose)
      cd "$CURRENT_LINK"
      if [[ -f docker-compose.yml ]]; then
        docker compose -f docker-compose.yml up -d --build
      elif [[ -f compose.yml ]]; then
        docker compose -f compose.yml up -d --build
      else
        echo "WARN: runtime docker-compose but compose file not found in current release"
      fi
      ;;
    pm2)
      cd "$CURRENT_LINK"
      if pm2 jlist 2>/dev/null | grep -q "\"name\":\"${APP_NAME}\""; then
        pm2 restart "$APP_NAME" --update-env
      else
        pm2 start dist/index.cjs --name "$APP_NAME"
      fi
      pm2 save
      ;;
    systemd)
      systemctl daemon-reload
      systemctl restart "${SERVICE_NAME}.service"
      ;;
    *)
      # Fallback: run/reload under pm2 for persistence if available.
      cd "$CURRENT_LINK"
      if command -v pm2 >/dev/null 2>&1; then
        if pm2 jlist 2>/dev/null | grep -q "\"name\":\"${APP_NAME}\""; then
          pm2 restart "$APP_NAME" --update-env
        else
          pm2 start dist/index.cjs --name "$APP_NAME"
        fi
        pm2 save
      fi
      ;;
  esac
}

health_check() {
  local health_url="http://127.0.0.1:${PORT}/api/health"
  local tries=15
  local wait_s=2

  for _ in $(seq 1 "$tries"); do
    if curl -fsS "$health_url" >/dev/null 2>&1; then
      echo "Health check passed: $health_url"
      return 0
    fi
    sleep "$wait_s"
  done

  echo "ERROR: Health check failed: $health_url"
  return 1
}

print_rollback_help() {
  cat <<EOF
Rollback commands:
  export APP_ROOT="${APP_ROOT}"
  export SERVICE_NAME="${SERVICE_NAME}"
  export APP_NAME="${APP_NAME}"
  bash "${CURRENT_LINK}/script/lightsail-rollback.sh"

Backup saved at:
  ${backup_path}
EOF
}

detect_runtime
echo "Detected runtime: ${runtime}"
backup_previous_release
backup_database
prepare_release
switch_release_and_restart
health_check
print_rollback_help

echo "Deploy completed successfully."
