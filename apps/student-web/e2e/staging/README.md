# Staging tests

Browser tests that run against a **real website and a real server**, signed in as one real test student.
Nothing is mocked and no app is built.

The everyday tests in `e2e/*.spec.ts` answer the server's calls themselves, so they prove the screens work
but not that the server does, and they cannot run on a deployed website. These tests are the other half.

```sh
npm run e2e:staging -w @prepzy/student-web      # then: npm run e2e:report -w @prepzy/student-web
```

They are not part of `npm run e2e` or CI.

## One-time setup

### 1. A test student with a fixed login code

On staging the server sends every login code by WhatsApp, except to a student whose `account.default_otp`
is set: that student always gets that code and no message is sent. Ask whoever looks after the staging
database to run this once, for a student that is `active` and has an active plan for the exam under test:

```sql
-- Staging database only.
UPDATE account
SET default_otp = 123456            -- any 6-digit code from 100000 to 999999; the same value goes in E2E_OTP
WHERE phone = '+91XXXXXXXXXX'       -- the test student's number, with the country code
  AND user_type = 'student'
  AND status = 'active';
```

Without it, every run sends a real WhatsApp message and the login step fails.

### 2. Settings

Create `apps/student-web/.env.e2e` (git-ignored; never commit or paste it anywhere):

| Setting | What it is |
|---|---|
| `E2E_BASE_URL` | The website under test, e.g. the staging student app. |
| `E2E_API_URL` | The server that website calls. |
| `E2E_EXAM` | The exam whose pages are opened: a slug from `src/shared/config/exams.ts` (`neet`, `cbse`, `jac`). The test student must have it. |
| `E2E_PHONE` | The test student's number with the country code (`+91…`). |
| `E2E_OTP` | The student's fixed 6-digit code (step 1). |
| `E2E_BROWSER_CHANNEL` | Optional. `chrome` uses the installed Chrome where Windows blocks Playwright's own browser. |

Both addresses must be this PC (`localhost`) or a host with `staging` in its name. Anything else stops the
run before a request is sent, so these tests can never touch production.

To run them against a backend on your own PC instead, point both addresses at `localhost` (the app on
`:3000`, the server on `:3005`) and use a student that is active in your local database.

## What a run does

1. `login.setup.ts` signs the student in through `/api/v4/auth/login-otp` and `/verify-login-otp` with one
   fixed device id, and keeps the session in the system's temp folder for the run.
2. `smoke.spec.ts` checks, read-only:
   - a signed-out visitor is sent to login, and the server answers 401 to a call without a login;
   - the saved login is accepted and the student has the exam in `E2E_EXAM`;
   - each main page opens: not sent back to login, no error screen, no server call answering 5xx or 401.

Nothing is added to the student's account.

## Rules

- **One run at a time per test student.** A new login replaces the session of the previous one (same device
  id), so two runs at once sign each other out.
- The server allows a student two devices. These tests are one; if the student is signed in on two others,
  the login step stops with `MAX_LOGIN_SESSIONS`.
- No traces are recorded: a trace would store the session cookies in the report folder.

## Adding a test

Put it in this folder as `*.spec.ts`, import `test` and `expect` from `@playwright/test`, and tag the
describe block `@staging`. Keep in mind:

- Assert only what holds for any data the student may have; put data-specific checks in the everyday tests.
- A test that writes (starts a test, changes the profile) leaves that on the staging account for good.
  Agree it with the team first and say so in a comment at the top of the test.
- Never write a phone number, code or address in a test; read them through `target.ts`.
