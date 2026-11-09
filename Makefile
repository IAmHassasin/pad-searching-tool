# PAD Searching Tool — local dev & assets
# Oracle Cloud: cd iac && make apply && make -f deploy.mk deploy

SHELL := /bin/bash
.SHELLFLAGS := -eu -o pipefail -c

AWAKENING_ROWS           ?= 15
AWAKENING_LAST_ROW_ICONS ?= 4

DUNGEON_URLS ?= dungeon-details/seed/dungeon-urls.txt

COMPOSE := docker compose -f docker-compose.yml -f docker-compose.cloud.yml

.PHONY: help up down awakenings-manifest seed-db dungeon-master dungeon-import dungeon-max-damage dungeon-floor-summary dungeon-max-hits icon-index

help:
	@echo "PAD Searching Tool — local Makefile"
	@echo ""
	@echo "Local Docker (cloud compose — DB from COMMUNITY_DB_URL):"
	@echo "  make up       — build + start (docker compose up -d --build)"
	@echo "                 → http://localhost:3000/dungeon-details"
	@echo "  make down     — stop + remove volumes (docker compose down -v)"
	@echo ""
	@echo "Database:"
	@echo "  make seed-db  — download seed/dadguide.sqlite (DB_DOWNLOAD_URL in .env)"
	@echo ""
	@echo "  make awakenings-manifest  — regen web/src/assets/pad/awakenings/manifest.json"
	@echo "      override: AWAKENING_ROWS=16 AWAKENING_LAST_ROW_ICONS=7"
	@echo ""
	@echo "Dungeon details (AppMedia parse, offline):"
	@echo "  make dungeon-master              — merge gimmick master from $(DUNGEON_URLS)"
	@echo "  make dungeon-master URL=<url>    — merge master from one AppMedia page"
	@echo "  make dungeon-import              — parse all URLs in $(DUNGEON_URLS)"
	@echo "  make dungeon-import URL=<url>    — parse one dungeon"
	@echo "  make dungeon-max-damage          — recompute maxDamage of every seed JSON (no fetch)"
	@echo "  make dungeon-floor-summary       — repair glued floor labels, recompute maxDamage + floorSummary (no fetch)"
	@echo "  make dungeon-max-hits            — resolve the max hit of every team-build catalog entry (AppMedia → Kamigame)"
	@echo ""
	@echo "Team build:"
	@echo "  make icon-index                  — (re)build web/public/team-build/icon-index.bin for 'Import from screenshot' (incremental, CDN from .env)"
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

dungeon-master:
ifdef URL
	node dungeon-details/scripts/build-gimmick-master.mjs $(URL)
else
	node dungeon-details/scripts/build-gimmick-master.mjs --urls $(DUNGEON_URLS)
endif

dungeon-max-hits:
	node dungeon-details/scripts/resolve-catalog-max-hits.mjs

icon-index:
	npm run icon-index

dungeon-max-damage:
	node dungeon-details/scripts/backfill-max-damage.mjs \
		--sqlite dungeon-details/seed/dungeons.sqlite

dungeon-floor-summary:
	node dungeon-details/scripts/backfill-floor-summary.mjs \
		--sqlite dungeon-details/seed/dungeons.sqlite

dungeon-import:
ifdef URL
	node dungeon-details/scripts/import-dungeon.mjs $(URL) \
		--sqlite dungeon-details/seed/dungeons.sqlite
else
	node dungeon-details/scripts/import-dungeon.mjs --urls $(DUNGEON_URLS) \
		--sqlite dungeon-details/seed/dungeons.sqlite
endif
