# Prepzy student frontend (v2)

Rebuilt student app, developed next to the old `AITutor_Student_Frontend` so the old code keeps running until this replaces it.

```
packages/design-system   One config file (design.config.ts) styles every component — see its README
apps/student-web         Next.js 15 / React 19 student app
```

## Run it

```bash
nvm use                                   # Node 22
npm install
cp apps/student-web/.env.example apps/student-web/.env.development   # fill in NEXT_PUBLIC_API_URL
npm run dev                               # http://localhost:3000
npm run storybook                         # design system catalogue, http://localhost:6006
```

| Command                                       | What it does                                                |
| --------------------------------------------- | ----------------------------------------------------------- |
| `npm run check`                               | Lint + type-check + unit tests for every package            |
| `npm run tokens`                              | Regenerate CSS from `design.config.ts`                      |
| `npm run build:production`                    | Production build (reads `apps/student-web/.env.production`) |
| `npx playwright test` (in `apps/student-web`) | End-to-end journeys on desktop and mobile, backend mocked   |

## How the app is organised

```
src/
  app/                     Routes only. Each page is a few lines that render a feature.
    (auth)/                login, get-started, verify-otp, exam-selection, setup
    (student)/[exam]/      every exam shares one route tree
      (app)/               pages with header + navigation: dashboard, tests, results
      (focus)/             full-screen test player
  features/<name>/         Everything for one feature
    index.ts               logic, hooks, types (cheap to import anywhere)
    ui.ts                  screens (imported only by the pages that render them)
  shared/
    config/                exams.ts (exam registry), routes.ts, navigation.ts, env.ts
    lib/                   api-client (fetch), errors, logger (Sentry), query client
    layout/                header, navigation, access check, status screens
  middleware.ts            signed-in / signed-out routing
```

**Exams are configuration, not pages.** `src/shared/config/exams.ts` describes each exam: category (board / competitive / reference), features, test types, theme and how sign-up completes. CBSE and NEET run on the same pages; adding JAC or JEE is a new registry entry.

**One exam engine.** Every test type uses the same player and result screen. Backend differences live in adapters (`features/exam-engine/adapters`): `board` for CBSE papers, `competitive` for NEET mock / PYQ / daily practice. Adding a test type = endpoints in `adapters/index.ts` + the key in the exam registry.

**Rules enforced by lint:** no `console.log`, no `any`, no inline exam-slug checks, no hard-coded hex colours, no axios, features imported only through `index` / `ui`.

## Status

Every student page of the previous app is ported.

| Area                                                                                                                       | State                     |
| -------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| Design system: tokens, themes, components, Storybook                                                                       | Done                      |
| Login, sign-up, OTP, exam selection, setup (CBSE class / NEET target year), welcome                                        | Done                      |
| Exam shell: header, exam switcher, navigation, access check, focus mode                                                    | Done                      |
| Dashboard — board (incl. no-plan state: My Free Courses, Get Ready For Your Exams, Choose Your Plan) and competitive       | Done                      |
| Board learn: subjects, courses, chapters, lectures, summary notes / video, chapter PYQs (+ "Your attempts"), NCERT         | Done                      |
| Competitive learn: chapters, video lectures, study notes, practice, chapter PYQs                                           | Done                      |
| Notes                                                                                                                      | Done                      |
| Board tests: mock + PYQ papers, custom tests (build + saved / submissions), chapter PYQ, mid, final, quiz, practice        | Done                      |
| Competitive tests: mock, PYQ library, daily practice, custom tests                                                         | Done                      |
| Exam player + results: rich-text written answers (TipTap, lazy-loaded) with photos, voice and fx symbols; report a problem | Done                      |
| Study plan, diagnostic test and result                                                                                     | Done                      |
| Doubt solver (Socrates), Atlas chat (incl. lecture Atlas, post-test review chat), live voice talk                          | Done                      |
| Plans, checkout / payments (Razorpay), billing history, refer & earn, profile                                              | Done                      |
| Parents, schools, partner portals                                                                                          | Not part of this port     |
| Reference books                                                                                                            | Needs a backend API first |

### Known differences from the previous app

- Live voice talk (Atlas, lecture tutor, Vedica) is ported (`features/live-voice`, loaded on first use). Its language menu says a change reconnects the call (the previous app wrongly said it applied from the next talk).
- Learn pages are rendered at 100% scale; the previous app zoomed them to 0.89.
- Notes open inside the app shell (header + navigation) instead of a bare full-screen page.
- Board custom tests pick course → one chapter → up to 5 topics → difficulty, like the live previous app; its question-type / count step was already disabled and is not ported. A generated test opens straight in the player (no success modal).
- Written answers use an "fx" symbol palette instead of the previous on-screen keyboard; photos are inserted inline in the answer (as before) rather than shown as a separate thumbnail list.
- Students without a plan don't see the plan banner (the previous app showed a "Topper Academic Year" card with no plan) and their weekly-hours chart shows the empty state.

### Visual comparison

`apps/student-web/visual/` screenshots the same page in the old app (port 3002) and this app (port 3200) with identical
mocked backend data (`visual/mocks*.ts`), at desktop and mobile size:

```bash
cd apps/student-web
PAIRS="cbse-dashboard|/cbse/dashboard|/cbse/dashboard|board" OUT=/tmp/shots npx playwright test -c visual/playwright.config.ts
```

Entries are `name|oldPath|newPath|exam[|click text]`; `exam` is `board`, `board-noplan` (no active plan), `competitive`
or `none`, `-` skips a side, and the optional last field clicks a button (e.g. to open a modal) before the screenshot.

## Backend issues found while porting (not fixed here)

- Board question payloads include `options[].is_correct`, so answers are visible in the browser before submitting.
- Case-based sub-question marks are read from `output.marks_obtained` instead of `output.similarity.marks_obtained`, so they likely score 0.
- OTP and login failures are returned as HTTP 200 with `{ error }`; the new client handles this, but the API should return 4xx.
- `/api/saveImage` has no authentication.
