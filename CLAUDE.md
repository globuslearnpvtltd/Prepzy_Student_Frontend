# Prepzy student frontend

The full project context (rules, exams/categories, design decisions, open items) is in `../CLAUDE.md`.
Claude Code loads it automatically from the parent folder; read it first if it isn't in context.

## Quick reference
- **App:** `apps/student-web`. **Design system:** `packages/design-system` (`design.config.ts` → `npm run tokens`).
- **Check everything:** `npm run verify` (or `npm run verify:full` to include the Playwright e2e).
- **Tests and coverage:**
  - unit/component tests: `npx vitest run` in `apps/student-web`;
  - coverage: `npm run test:coverage -w @prepzy/student-web`.
- **Browser tests:** `npm run e2e -w @prepzy/student-web`, then `npm run e2e:report -w @prepzy/student-web` (a screenshot for every test).
- **Add an exam:**
  - one entry in `apps/student-web/src/shared/config/exams.ts`;
  - plus `public/illustrations/exams/<exam_slice>.png`.
- **Never use `.next` for your own builds** (the user's dev server on :3000 uses it). Set `NEXT_DIST_DIR=.next-<name>`, delete that folder afterwards and run `node apps/student-web/scripts/clean-tsconfig-includes.mjs`.
- **Don't read `.env*` files.** Make no git changes unless asked.
