.PHONY: help install dev build preview lint format format-check typecheck \
        test test-e2e check gen-api clean

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

install: ## Install deps (pnpm; needs Node 22 — see .nvmrc)
	pnpm install

dev: ## Dev server with hot reload
	pnpm dev

build: ## Production build
	pnpm build

preview: ## Preview the built server
	pnpm preview

lint: ## ESLint
	pnpm lint

format: ## Prettier (write)
	pnpm format

format-check: ## Prettier (check only, CI)
	pnpm format:check

typecheck: ## astro check
	pnpm typecheck

test: ## Unit tests (vitest)
	pnpm test

test-e2e: ## E2E (Playwright)
	pnpm test:e2e

check: ## Lint + format-check + typecheck + unit tests (local CI gate)
	pnpm check

gen-api: ## Generate API types from backend OpenAPI (API_OPENAPI env)
	pnpm gen:api

clean: ## Remove build artefacts + deps
	rm -rf dist node_modules .astro
