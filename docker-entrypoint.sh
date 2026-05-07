#!/bin/sh
set -eu

DATA_DIR="${DATA_DIR:-/data}"
mkdir -p "$DATA_DIR"

DB_FILE="${SQLITE_PATH:-$DATA_DIR/pad.db}"

if [ -n "${DB_DOWNLOAD_URL:-}" ]; then
  echo "Downloading SQLite database from DB_DOWNLOAD_URL..."
  if command -v wget >/dev/null 2>&1; then
    wget -q -O "$DB_FILE" "$DB_DOWNLOAD_URL"
  else
    curl -fsSL -o "$DB_FILE" "$DB_DOWNLOAD_URL"
  fi
fi

if [ ! -f "$DB_FILE" ]; then
  echo "ERROR: SQLite file not found at ${DB_FILE}."
  echo "Set DB_DOWNLOAD_URL to a reachable URL, or mount a .db file to this path."
  exit 1
fi

echo "Using database: $DB_FILE"
exec node dist/main.js
