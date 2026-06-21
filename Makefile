# PAD Searching Tool — local dev & assets
# Oracle Cloud: cd iac && make apply && make -f deploy.mk deploy

SHELL := /bin/bash
.SHELLFLAGS := -eu -o pipefail -c

AWAKENING_ROWS           ?= 15
AWAKENING_LAST_ROW_ICONS ?= 4

COMPOSE := docker compose -f docker-compose.yml -f docker-compose.cloud.yml

.PHONY: help up down awakenings-manifest seed-db

help:
	@echo "PAD Searching Tool — local Makefile"
	@echo ""
	@echo "Local Docker (cloud compose — DB from COMMUNITY_DB_URL):"
	@echo "  make up       — build + start (docker compose up -d --build)"
	@echo "  make down     — stop + remove volumes (docker compose down -v)"
	@echo ""
	@echo "Database:"
	@echo "  make seed-db  — download seed/dadguide.sqlite (DB_DOWNLOAD_URL in .env)"
	@echo ""
	@echo "  make awakenings-manifest  — regen web/src/assets/pad/awakenings/manifest.json"
	@echo "      override: AWAKENING_ROWS=16 AWAKENING_LAST_ROW_ICONS=7"
	@echo ""
	@echo "Oracle Cloud (iac/):"
	@echo "  cd iac && make apply"
	@echo "  cd iac && make -f deploy.mk deploy"
	@echo "  cd iac && make -f deploy.mk deploy-all"

up:
	$(COMPOSE) up -d --build

down:
	$(COMPOSE) down -v

awakenings-manifest:
	node scripts/generate-awakening-manifest.mjs \
		--sprite-width 1000 --sprite-height 1000 \
		--tile-width 31 --tile-height 32 --gap 1 \
		--columns 10 --rows $(AWAKENING_ROWS) --last-row-icons $(AWAKENING_LAST_ROW_ICONS)

seed-db:
	npm run pad -- seed-db
