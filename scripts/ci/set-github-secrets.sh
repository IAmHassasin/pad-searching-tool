#!/usr/bin/env bash
# Push the secrets used by .github/workflows/cd.yml from local files to GitHub.
# Values are read from local (gitignored) files and piped to `gh`; nothing is printed.
#
# Run from the repo root in Git Bash:  bash scripts/ci/set-github-secrets.sh
# Requires: gh (authenticated with repo admin), terraform state in iac/,
# and a ~/.ssh/known_hosts entry for the VM (created by a previous `make deploy`
# or `ssh opc@<ip>`; verify the fingerprint once by hand).
#
# Optional overrides: APP_DOMAIN, ORIGIN_HOST (used when terraform state has no such output),
# ANDROID_DEBUG_KEYSTORE, KNOWN_HOSTS_FILE, REPO.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
REPO="${REPO:-$(gh repo view --json nameWithOwner -q .nameWithOwner)}"
KEYSTORE="${ANDROID_DEBUG_KEYSTORE:-$HOME/.android/debug.keystore}"
KNOWN_HOSTS_FILE="${KNOWN_HOSTS_FILE:-$HOME/.ssh/known_hosts}"

fail() { echo "ERROR: $*" >&2; exit 1; }
require_file() { [ -s "$1" ] || fail "missing or empty: $1"; }
tf_output() { terraform -chdir=iac output -raw "$1" 2>/dev/null || true; }

# Resolve and validate every value BEFORE touching GitHub, so a failure
# can never overwrite an existing secret with an empty value.
require_file .env
require_file web/.env.android
require_file key/vm_ssh.pem
require_file "$KEYSTORE"

oracle_host="$(tf_output public_ip)"
[ -n "$oracle_host" ] || fail "terraform output public_ip is empty (run 'terraform init' in iac/)"

known_hosts="$(ssh-keygen -F "$oracle_host" -f "$KNOWN_HOSTS_FILE" 2>/dev/null | grep -v '^#' || true)"
[ -n "$known_hosts" ] || fail "no entry for $oracle_host in $KNOWN_HOSTS_FILE (ssh to the VM once and verify the fingerprint)"

app_domain="${APP_DOMAIN:-$(tf_output app_domain)}"
origin_host="${ORIGIN_HOST:-$(tf_output origin_hostname)}"

keystore_b64="$(base64 -w0 "$KEYSTORE")"
[ -n "$keystore_b64" ] || fail "could not encode $KEYSTORE"

set_secret() { # name value
  printf '%s' "$2" | gh secret set "$1" --repo "$REPO"
}

echo "Setting secrets on $REPO ..."
gh secret set PROD_ENV_FILE          --repo "$REPO" < .env
gh secret set ANDROID_ENV_FILE       --repo "$REPO" < web/.env.android
gh secret set ORACLE_SSH_PRIVATE_KEY --repo "$REPO" < key/vm_ssh.pem
set_secret ANDROID_DEBUG_KEYSTORE_BASE64 "$keystore_b64"
set_secret ORACLE_HOST        "$oracle_host"
set_secret ORACLE_KNOWN_HOSTS "$known_hosts"

# Optional: empty means Caddy listens on :80 only (same as deploy.mk without these outputs).
for pair in "APP_DOMAIN=$app_domain" "ORIGIN_HOST=$origin_host"; do
  name="${pair%%=*}"; value="${pair#*=}"
  if [ -n "$value" ]; then
    set_secret "$name" "$value"
  else
    echo "WARN: $name has no value; skipped (deploy treats it as optional)."
  fi
done

echo "Done. Current secrets:"
gh secret list --repo "$REPO"
