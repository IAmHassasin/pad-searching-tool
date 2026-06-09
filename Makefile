# PAD Searching Tool — deploy / update / restart on Oracle VM
# Requires: make, tar, ssh, scp, bash (Git Bash / WSL / Linux / macOS)

SHELL := /bin/bash
.ONESHELL:
.SHELLFLAGS := -eu -o pipefail -c
#
# Usage (from project root, secrets on command line — do not commit):
#
#   make deploy ORACLE_HOST=1.2.3.4 \
#     COMMUNITY_DB_URL=https://.../dadguide.sqlite \
#     ADMIN_PASSWORD='...' ADMIN_JWT_SECRET='...'
#
#   make update  ORACLE_HOST=1.2.3.4
#   make restart ORACLE_HOST=1.2.3.4
#   make logs    ORACLE_HOST=1.2.3.4
#   make status  ORACLE_HOST=1.2.3.4
#
# Optional: SSH_KEY=~/.ssh/id_rsa  ORACLE_USER=opc  REMOTE_DIR=~/pad-searching-tool

ORACLE_HOST   ?=
ORACLE_USER   ?= opc
REMOTE_DIR    ?= ~/pad-searching-tool
SSH_KEY       ?=
ENV_FILE      ?= .env

# Secrets — pass when calling make (override values in ENV_FILE on the VM)
COMMUNITY_DB_URL   ?=
ADMIN_USERNAME     ?=
ADMIN_PASSWORD     ?=
ADMIN_JWT_SECRET   ?=

COMPOSE := docker compose -f docker-compose.yml -f docker-compose.cloud.yml

ifneq ($(SSH_KEY),)
SSH := ssh -i $(SSH_KEY) -o StrictHostKeyChecking=accept-new
SCP := scp -i $(SSH_KEY) -o StrictHostKeyChecking=accept-new
else
SSH := ssh -o StrictHostKeyChecking=accept-new
SCP := scp -o StrictHostKeyChecking=accept-new
endif

REMOTE := $(ORACLE_USER)@$(ORACLE_HOST)
SSH_RUN = $(SSH) $(REMOTE)

define REMOTE_PATCH_ENV
set -euo pipefail
cd "$$REMOTE_DIR"
test -f .env.upload
mv -f .env.upload .env
chmod 600 .env
patch_var() {
  key="$$1"
  val="$$2"
  [ -n "$$val" ] || return 0
  grep -v "^$$key=" .env > .env.tmp 2>/dev/null || true
  printf '%s=%s\n' "$$key" "$$val" >> .env.tmp
  mv -f .env.tmp .env
  chmod 600 .env
}
patch_var COMMUNITY_DB_URL "$$PATCH_COMMUNITY_DB_URL"
patch_var ADMIN_USERNAME "$$PATCH_ADMIN_USERNAME"
patch_var ADMIN_PASSWORD "$$PATCH_ADMIN_PASSWORD"
patch_var ADMIN_JWT_SECRET "$$PATCH_ADMIN_JWT_SECRET"
if grep -q '^SQLITE_SNAPSHOT_PATH=' .env 2>/dev/null; then
  grep -v '^SQLITE_SNAPSHOT_PATH=' .env > .env.tmp
  mv -f .env.tmp .env
  chmod 600 .env
fi
echo "Remote .env ready."
endef
export REMOTE_PATCH_ENV

.PHONY: help up down deploy update restart logs status ssh sync-env sync-app remote-up remote-restart check-host

help:
	@echo "PAD deploy Makefile (Oracle VM)"
	@echo ""
	@echo "Local Docker (cloud compose — DB from COMMUNITY_DB_URL):"
	@echo "  make up       — build + start (docker compose up -d --build)"
	@echo "  make down     — stop + remove volumes (docker compose down -v)"
	@echo ""
	@echo "  make deploy   ORACLE_HOST=... [secrets]  — sync app + .env, build, start"
	@echo "  make update   ORACLE_HOST=... [secrets]  — same as deploy (pull code + rebuild)"
	@echo "  make restart  ORACLE_HOST=...            — docker compose restart"
	@echo "  make logs     ORACLE_HOST=...            — follow container logs"
	@echo "  make status   ORACLE_HOST=...            — docker compose ps"
	@echo "  make ssh      ORACLE_HOST=...            — shell on VM"
	@echo ""
	@echo "Secrets (optional if already in $(ENV_FILE)):"
	@echo "  COMMUNITY_DB_URL  ADMIN_USERNAME  ADMIN_PASSWORD  ADMIN_JWT_SECRET"
	@echo ""
	@echo "Example:"
	@echo "  make deploy ORACLE_HOST=10.0.0.5 COMMUNITY_DB_URL=https://... \\" 
	@echo "    ADMIN_PASSWORD='secret' ADMIN_JWT_SECRET='secret32chars...'"

check-host:
	@test -n "$(ORACLE_HOST)" || (echo "ERROR: set ORACLE_HOST=<vm-public-ip>" && exit 1)

# ── Public targets ───────────────────────────────────────────────────────────

up:
	$(COMPOSE) up -d --build

down:
	$(COMPOSE) down -v

deploy: check-host sync-app sync-env remote-up
	@echo "Deploy finished → http://$(ORACLE_HOST):3000"

update: deploy

restart: check-host remote-restart
	@echo "Container restarted."

logs: check-host
	$(SSH_RUN) "cd $(REMOTE_DIR) && $(COMPOSE) logs -f --tail=200"

status: check-host
	$(SSH_RUN) "cd $(REMOTE_DIR) && $(COMPOSE) ps && echo && curl -fsS http://127.0.0.1:3000/health || true"

ssh: check-host
	$(SSH) $(REMOTE)

# ── Sync ─────────────────────────────────────────────────────────────────────

sync-app: check-host
	@echo "Syncing application to $(REMOTE):$(REMOTE_DIR) ..."
	$(SSH_RUN) "mkdir -p $(REMOTE_DIR)"
	tar -czf - \
		--exclude=node_modules \
		--exclude=web/node_modules \
		--exclude=.git \
		--exclude=dist \
		--exclude=web/dist \
		--exclude=.env \
		--exclude=.env.local \
		--exclude='*.sqlite' \
		--exclude='*.sqlite-*' \
		--exclude=exports/category-bundles \
		--exclude=terminals \
		. | $(SSH_RUN) "cd $(REMOTE_DIR) && tar -xzf -"

sync-env: check-host
	@test -f "$(ENV_FILE)" || (echo "ERROR: $(ENV_FILE) not found (copy .env.example)" && exit 1)
	@echo "Uploading $(ENV_FILE) → VM .env"
	$(SCP) "$(ENV_FILE)" "$(REMOTE):$(REMOTE_DIR)/.env.upload"
	printf '%s\n' "$$REMOTE_PATCH_ENV" | $(SSH) $(REMOTE) env \
		REMOTE_DIR="$(REMOTE_DIR)" \
		PATCH_COMMUNITY_DB_URL='$(COMMUNITY_DB_URL)' \
		PATCH_ADMIN_USERNAME='$(ADMIN_USERNAME)' \
		PATCH_ADMIN_PASSWORD='$(ADMIN_PASSWORD)' \
		PATCH_ADMIN_JWT_SECRET='$(ADMIN_JWT_SECRET)' \
		bash -s

# ── Remote Docker ────────────────────────────────────────────────────────────

remote-up: check-host
	@echo "Building and starting containers on VM..."
	$(SSH_RUN) "cd $(REMOTE_DIR) && $(COMPOSE) up -d --build"

remote-restart: check-host
	$(SSH_RUN) "cd $(REMOTE_DIR) && $(COMPOSE) restart"
