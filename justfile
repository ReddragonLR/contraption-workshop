# Contraption Workshop — single local entry point (see ~/Projects/CLAUDE.md).
# This is a static, fully client-side game: there are no backend services to
# orchestrate, so `just dev` (alias `just up`) starts the entire local stack —
# the Vite dev server — and the front-end is immediately exercisable against it.
# Run `just` with no arguments to list every recipe.

# Show all recipes (default).
default:
    @just --list

# Install dependencies (Node 20+ — see .nvmrc).
install:
    npm install

# Start the whole local stack (the dev server with HMR) at http://localhost:5173.
dev: install
    npm run dev

# Alias for `dev`, per the CLAUDE.md "start everything" convention.
up: dev

# Type-check and build the production bundle to dist/.
build: install
    npm run build

# Serve the production build locally at http://localhost:4173.
preview: build
    npm run preview

# Unit tests (Vitest, CI mode).
test: install
    npm test

# End-to-end tests (Playwright; auto-builds + serves the preview).
test-e2e: install
    npm run test:e2e

# Full local test suite: unit + e2e.
test-all: test test-e2e

# Lint (ESLint).
lint: install
    npm run lint

# Auto-format (Prettier).
fmt: install
    npm run format

# Pre-deploy quality gate: lint + unit + e2e (what CI/deploy depends on).
check: lint test test-e2e

# Build (gated on `check`) and deploy to Firebase Hosting.
# Override the project with: just deploy my-project
deploy project_id="game-the-incredible-machine": check
    PROJECT_ID={{project_id}} npm run deploy

# Remove build artifacts and test output.
clean:
    rm -rf dist playwright-report test-results
