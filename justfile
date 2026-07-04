# List all available recipes
default:
    @just --list

# install dependencies with pnpm
install:
    pnpm install

# start the Vite dev server
dev:
    pnpm run dev

# build the production bundle
build:
    pnpm run build

# serve the production build locally
preview:
    pnpm run preview

# run the Vitest test suite (passes with no tests)
test:
    pnpm run test

# type-check with tsc (no emit)
typecheck:
    pnpm run typecheck

# lint the codebase with ESLint
lint:
    pnpm run lint

# format all files with Prettier
format:
    pnpm run format

# check formatting without writing
format-check:
    pnpm run format:check
