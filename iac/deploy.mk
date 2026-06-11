# PAD Searching Tool — sync app to Oracle VM (after terraform apply)
# Run from repo:  cd iac && make -f deploy.mk deploy
# Windows: Git Bash (recommended) or CMD with Git for Windows in PATH

IAC_DIR := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))
ROOT    := $(abspath $(IAC_DIR)/..)

# Use 2>/dev/null — NOT 2>NUL (bash creates iac/NUL file on Windows, breaks git)
ORACLE_HOST   ?= $(shell terraform -chdir="$(IAC_DIR)" output -raw public_ip 2>/dev/null)
ORACLE_USER   ?= opc
REMOTE_DIR    ?= ~/pad-searching-tool
SSH_KEY       ?= $(if $(wildcard $(ROOT)/key/vm_ssh.pem),$(ROOT)/key/vm_ssh.pem,)
ENV_FILE      ?= $(ROOT)/.env

APP_DOMAIN    ?= $(shell terraform -chdir="$(IAC_DIR)" output -raw app_domain 2>/dev/null)
ORIGIN_HOST   ?= $(shell terraform -chdir="$(IAC_DIR)" output -raw origin_hostname 2>/dev/null)

COMMUNITY_DB_URL   ?=
ADMIN_USERNAME     ?=
ADMIN_PASSWORD     ?=
ADMIN_JWT_SECRET   ?=

COMPOSE := docker compose -f docker-compose.yml -f docker-compose.cloud.yml
# opc may lack docker group in non-interactive SSH until re-login — use sudo on VM
COMPOSE_REMOTE := sudo $(COMPOSE)

# Windows ezwinports make runs recipes in CMD unless SHELL points to Git Bash
ifeq ($(OS),Windows_NT)
SHELL := C:/Program\ Files/Git/usr/bin/bash.exe
else
SHELL := /bin/bash
endif

.ONESHELL:
.SHELLFLAGS := -eu -o pipefail -c

ifneq ($(SSH_KEY),)
ifeq ($(OS),Windows_NT)
SSH := "C:/Program Files/Git/usr/bin/ssh.exe" -i "$(SSH_KEY)" -o StrictHostKeyChecking=accept-new
SCP := "C:/Program Files/Git/usr/bin/scp.exe" -i "$(SSH_KEY)" -o StrictHostKeyChecking=accept-new
else
SSH := ssh -i "$(SSH_KEY)" -o StrictHostKeyChecking=accept-new
SCP := scp -i "$(SSH_KEY)" -o StrictHostKeyChecking=accept-new
endif
else
ifeq ($(OS),Windows_NT)
SSH := "C:/Program Files/Git/usr/bin/ssh.exe" -o StrictHostKeyChecking=accept-new
SCP := "C:/Program Files/Git/usr/bin/scp.exe" -o StrictHostKeyChecking=accept-new
else
SSH := ssh -o StrictHostKeyChecking=accept-new
SCP := scp -o StrictHostKeyChecking=accept-new
endif
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

.PHONY: help deploy deploy-all update restart logs status ssh sync-env sync-app remote-bootstrap remote-up remote-restart check-host check-env

help:
	@echo "Deploy app to Oracle VM (run from iac/)"
	@echo ""
	@echo "  make -f deploy.mk deploy      — sync code + .env, build, start"
	@echo "  make -f deploy.mk deploy-all  — terraform apply + deploy"
	@echo "  make -f deploy.mk update      — same as deploy"
	@echo "  make -f deploy.mk restart     — docker compose restart"
	@echo "  make -f deploy.mk logs        — follow container logs"
	@echo "  make -f deploy.mk status      — ps + /health"
	@echo "  make -f deploy.mk ssh         — shell on VM"
	@echo ""
	@echo "Windows CMD:  deploy.cmd deploy   (recommended)"
	@echo "Git Bash:     make -f deploy.mk deploy"
	@echo ""
	@echo "ORACLE_HOST auto-read from terraform output (140.245.59.226 after apply)"
	@echo "Override: make -f deploy.mk deploy ORACLE_HOST=1.2.3.4"

check-host:
ifeq ($(strip $(ORACLE_HOST)),)
	$(error ERROR: ORACLE_HOST empty. Run "make apply" in iac/, or: make -f deploy.mk deploy ORACLE_HOST=140.245.59.226)
endif

check-env:
ifeq ($(wildcard $(ENV_FILE)),)
	$(error ERROR: $(ENV_FILE) not found (copy .env.example))
endif

deploy-all:
	$(MAKE) -C $(IAC_DIR) apply
	$(MAKE) -f $(IAC_DIR)/deploy.mk deploy
	@echo "Infrastructure + app deploy complete."
	@terraform -chdir="$(IAC_DIR)" output cloudflare_dns_hint

deploy: check-host sync-app sync-env remote-bootstrap remote-up
	@echo "Deploy finished → http://$(ORACLE_HOST):3000"

update: deploy

restart: check-host remote-restart
	@echo "Container restarted."

logs: check-host
	$(SSH_RUN) "cd $(REMOTE_DIR) && $(COMPOSE_REMOTE) logs -f --tail=200"

status: check-host
	$(SSH_RUN) "cd $(REMOTE_DIR) && $(COMPOSE_REMOTE) ps && echo && curl -fsS http://127.0.0.1:3000/health || true"

ssh: check-host
	$(SSH) $(REMOTE)

sync-app: check-host
	@echo "Syncing application to $(REMOTE):$(REMOTE_DIR) ..."
	$(SSH_RUN) "mkdir -p $(REMOTE_DIR)"
	cd "$(ROOT)" && tar -czf - \
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
		--exclude=iac/.terraform \
		--exclude='iac/*.tfstate*' \
		. | $(SSH_RUN) "cd $(REMOTE_DIR) && tar -xzf -"

sync-env: check-host check-env
	@echo "Uploading $(ENV_FILE) → VM .env"
	$(SCP) "$(ENV_FILE)" "$(REMOTE):$(REMOTE_DIR)/.env.upload"
	printf '%s\n' "$$REMOTE_PATCH_ENV" | $(SSH) $(REMOTE) env \
		REMOTE_DIR="$(REMOTE_DIR)" \
		PATCH_COMMUNITY_DB_URL='$(COMMUNITY_DB_URL)' \
		PATCH_ADMIN_USERNAME='$(ADMIN_USERNAME)' \
		PATCH_ADMIN_PASSWORD='$(ADMIN_PASSWORD)' \
		PATCH_ADMIN_JWT_SECRET='$(ADMIN_JWT_SECRET)' \
		bash -s

remote-bootstrap: check-host
	@echo "Ensuring Docker + Caddy on VM..."
	$(SCP) "$(IAC_DIR)scripts/vm-bootstrap.sh" "$(REMOTE):/tmp/pad-vm-bootstrap.sh"
	$(SSH_RUN) "sed -i 's/\\r$$//' /tmp/pad-vm-bootstrap.sh && chmod +x /tmp/pad-vm-bootstrap.sh && APP_DOMAIN='$(APP_DOMAIN)' ORIGIN_HOST='$(ORIGIN_HOST)' bash /tmp/pad-vm-bootstrap.sh"

remote-up: check-host
	@echo "Building and starting containers on VM..."
	$(SSH_RUN) "cd $(REMOTE_DIR) && $(COMPOSE_REMOTE) up -d --build"

remote-restart: check-host
	$(SSH_RUN) "cd $(REMOTE_DIR) && $(COMPOSE_REMOTE) restart"
