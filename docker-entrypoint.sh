#!/bin/sh
set -eu

DATA_DIR="${DATA_DIR:-/data}"
mkdir -p "$DATA_DIR"

WORKING_DB="${SQLITE_PATH:-$DATA_DIR/pad.db}"
SEED_PATH="${SQLITE_SNAPSHOT_PATH:-}"

download_to() {
  url="$1"
  dest="$2"
  echo "Downloading SQLite seed from URL..."
  if command -v wget >/dev/null 2>&1; then
    wget -q -O "$dest" "$url"
  else
    curl -fsSL -o "$dest" "$url"
  fi
}

# Same preference order as src/import-external-db.ts (community URL → working DB seed).
first_nonempty_url() {
  u=""
  [ -n "${COMMUNITY_DB_URL:-}" ] && u="$COMMUNITY_DB_URL"
  [ -z "$u" ] && [ -n "${EXTERNAL_DB_URL:-}" ] && u="$EXTERNAL_DB_URL"
  [ -z "$u" ] && [ -n "${DB_DOWNLOAD_URL:-}" ] && u="$DB_DOWNLOAD_URL"
  printf '%s' "$u" | tr -d '\r' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//'
}

DB_URL="$(first_nonempty_url)"

if [ -z "$SEED_PATH" ] && [ -n "$DB_URL" ]; then
  SEED_DL="${DATA_DIR}/community-snapshot.sqlite"
  download_to "$DB_URL" "$SEED_DL"
  SEED_PATH="$SEED_DL"
fi

if [ -n "$SEED_PATH" ]; then
  if [ -d "$SEED_PATH" ]; then
    echo "ERROR: Seed path ${SEED_PATH} is a directory, not a file."
    echo "On Docker Desktop, this usually means the host bind-mount source path does not exist:"
    echo "Compose uses \"host/path:/seed/dadguide.sqlite\" — the left side must be your real .sqlite file."
    exit 1
  fi
  if [ ! -f "$SEED_PATH" ]; then
    echo "ERROR: Seed file not found at ${SEED_PATH}."
    echo "Fix the volume mount (host file path) or SQLITE_SNAPSHOT_PATH in .env."
    exit 1
  fi
  if [ ! -f "$WORKING_DB" ] || [ "${FORCE_SQLITE_INIT:-}" = "true" ]; then
    echo "Initializing working DB from immutable seed:"
    echo "  ${SEED_PATH} -> ${WORKING_DB}"
    cp -f "$SEED_PATH" "$WORKING_DB"
  else
    echo "Keeping existing working DB at ${WORKING_DB} (set FORCE_SQLITE_INIT=true to overwrite from seed)."
  fi
fi

if [ ! -f "$WORKING_DB" ]; then
  echo "ERROR: SQLite file not found at ${WORKING_DB}."
  echo "Set COMMUNITY_DB_URL (or EXTERNAL_DB_URL / DB_DOWNLOAD_URL), mount SQLITE_SNAPSHOT_PATH, or bind-mount an existing DB at SQLITE_PATH."
  exit 1
fi

echo "Using database: $WORKING_DB"
exec node dist/main.js
