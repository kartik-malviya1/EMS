# REFACTOR.md — Clean code, structure and best practices

How to use: run this AFTER the feature phases are done (after Phase 10 or 11) and while no other agent is working in the repo. Paste the "Master prompt" at the bottom. The guidance sections are the rules the agent must apply; add them to CLAUDE.md as section 17 if you want them to apply to future work too.

Sources this is based on (paraphrased, not copied): goldbergyoni/nodebestpractices; Express official "Production best practices" (security, performance and reliability); Microsoft "Best practices for RESTful web API design" and the Microsoft/Azure REST API Guidelines; React docs "You Might Not Need an Effect"; Redux Toolkit / RTK Query style guidance; Robert C. Martin, *Clean Code* (summaries) and Martin Fowler, *Refactoring* (catalog of smells and transformations). Where a rule below is mine rather than a direct source rule, it is marked (project rule).

---

## 0. Ground rules for any refactor

1. **Behaviour-preserving.** A refactor changes structure, not behaviour. No new features, no changed business rules, no changed error codes, no changed response shapes.
2. **Green baseline first.** Run server + client lint, build and tests before touching anything. If something is already red, report it and fix it in its own commit.
3. **Safety net before moving code.** If a piece of code has no test, write a characterization test (assert what it does today) before refactoring it.
4. **API contract is frozen** unless a step explicitly says otherwise. Add a contract test that snapshots the route table (method + path + allowed roles) and the response envelope shape; it must stay green throughout.
5. **Small steps, one concern per commit** (Conventional Commits: `refactor(server): ...`). After every step: lint, build, tests. Never leave the repo red between commits.
6. **No drive-by changes.** If you spot a bug while refactoring, do not silently fix it inside a refactor commit: write it down, fix it in a separate `fix:` commit with a test.
7. **Delete dead code**, unused exports, unused dependencies, commented-out code and stale TODOs (Clean Code: don't comment out code; version control remembers).
8. Prefer boring and obvious over clever. If a reviewer needs a comment to understand a line, rename or extract instead (Clean Code: explain yourself in code; comments only for *why*).

---

## 1. Universal clean-code rules

| Rule | What to do | Smell it removes |
|---|---|---|
| Meaningful names | Name by intent: `calculateWorkedMinutes`, not `calc`; booleans read as questions (`isEligibleForOvertime`); no abbreviations except universal ones (`id`, `url`) | Mystery code |
| Small functions, one job | Aim ≤ ~30 lines and one level of abstraction per function; extract until each function reads like a sentence (project rule: warn at 50 lines) | Long method |
| Few parameters | ≤ 3 positional; otherwise one options object with a named type | Long parameter list |
| Guard clauses / early return | Reject invalid cases first, keep the happy path flat; max nesting depth 3 | Arrow code |
| No magic values | Move strings/numbers to named constants (`WORKING_STATUS.COMPLETED`, `STANDARD_SHIFT_MINUTES`) | Magic numbers/strings |
| DRY, but only real duplication | Extract when the same *rule* appears 3 times, not when two lines merely look alike | Duplicated code |
| Single Responsibility | A module/function has one reason to change | God file/class |
| Command–query separation | A function either changes state or returns data, rarely both | Surprising side effects |
| Newspaper layout | Public/high-level function first, helpers below it, related code vertically close | Hard-to-read files |
| Consistent patterns | One way of doing each thing (one error style, one response style, one naming style) | Inconsistency |
| Comments explain *why* | Delete comments that restate code; keep business-rule rationale | Noise |

Example — guard clauses and naming:

```js
// BEFORE
async function ot(req, res) {
  const a = await Attendance.findById(req.params.id);
  if (a) {
    if (a.employeeId.toString() === req.user._id.toString()) {
      if (a.workingStatus === 'completed') {
        if (a.workedMinutes > 480) {
          if (req.body.requestedMinutes <= a.workedMinutes - 480) {
            // ...do it
          } else { return res.status(400).json({ message: 'too many' }); }
        } else { return res.status(409).json({ message: 'no ot' }); }
      }
    }
  }
}

// AFTER (service)
export async function requestOvertime(user, attendanceId, { requestedMinutes, reason }) {
  const attendance = await findOwnedAttendanceOrThrow(user, attendanceId);
  assertOvertimeRequestable(attendance, requestedMinutes);
  return saveOvertimeRequest(attendance, { requestedMinutes, reason });
}

function assertOvertimeRequestable(attendance, requestedMinutes) {
  if (attendance.workingStatus !== WORKING_STATUS.COMPLETED) throw ApiError.conflict('OVERTIME_NOT_REQUESTABLE', '...');
  const maxMinutes = attendance.workedMinutes - STANDARD_SHIFT_MINUTES;
  if (maxMinutes < 1) throw ApiError.conflict('OVERTIME_NOT_REQUESTABLE', '...');
  if (requestedMinutes > maxMinutes) throw ApiError.badRequest('VALIDATION_ERROR', '...');
}
```

---

## 2. Node.js / Express structure and practices

### 2.1 Structure
- Layering rule (dependency direction only goes downward): `routes → controllers → services → models/utils`. Routes never contain logic; controllers never touch models; services never touch `req`/`res`; models contain schema, validation and indexes only.
- Experts (nodebestpractices) recommend organising by business component rather than by technical role. This project's decision: **server code is organised as feature modules**, each with its own layers:

```
server/src/
  config/            env.js (the ONLY place that reads process.env), db.js, constants.js
  modules/
    auth/        auth.routes.js  auth.controller.js  auth.service.js  auth.validator.js
    users/       users.routes.js ... user.model.js
    attendance/  attendance.routes.js ... attendance.model.js, attendance.calculations.js (pure functions)
    overtime/    ...
    reports/     ...
    notifications/ ...
    settings/    ...
  shared/        middleware/ (auth, validate, errorHandler, rateLimiter, originCheck), utils/ (ApiError, response, logger, time), storage/, realtime/
  jobs/
  scripts/
  app.js  server.js
tests/           mirrors modules/
```
  Cross-module imports go through the other module's `index.js` public API (service functions), never deep into its internals or its model.
- Keep `app.js` (builds app, no listening) separate from `server.js` (listens, connects DB, starts jobs/sockets) so tests import the app (nodebestpractices: separate Express "app" and "server").
- One router per module; `routes/index.js` mounts them. No giant route files.

### 2.2 Configuration
- Read `process.env` in exactly one file, validate it with Zod at startup, export a frozen typed config object. Everywhere else imports `config`, never `process.env`.
- Config values never get hardcoded in code (URLs, secrets, thresholds).

### 2.3 Errors
- Throw `ApiError` subclasses/factories (`ApiError.notFound(...)`, `.conflict(code, msg)`) from services; never throw strings or plain objects; always extend `Error` (nodebestpractices).
- Distinguish operational errors (expected: validation, not found, conflict) from programmer errors (bugs): operational → mapped response; programmer → logged with stack, generic 500, never leaked.
- One centralised error handler; controllers do not have try/catch that formats responses. Express 5 forwards rejected promises from async handlers to the error middleware automatically, so the `asyncHandler` wrapper is unnecessary: remove it only after confirming with a test that a rejected async handler yields the standard error envelope.
- Handle errors close to where recovery is possible (e.g. storage cleanup after a failed DB write); otherwise let them propagate.
- Never swallow errors with empty `catch {}`; at minimum log with context.
- Process level: handle `unhandledRejection`/`uncaughtException` by logging and exiting; graceful shutdown on SIGTERM/SIGINT (close HTTP server, sockets, cron, Mongo connection) (Express production guidance + nodebestpractices).

```js
// controller: thin
export const punchIn = async (req, res) => {
  const attendance = await attendanceService.punchIn(req.user, req.file, req.body);
  created(res, attendance);
};
```

### 2.4 Validation and security (Express security guidance)
- Validate every request (body, query, params) with strict Zod schemas in the module's validator; services receive already-valid data.
- Never pass raw request objects into queries; pick fields explicitly (mass-assignment safe).
- Helmet, restricted CORS, rate limits, request size limits, remove `X-Powered-By`, secure cookies, no stack traces in responses, generic auth errors, `npm audit` in CI, no secrets in git (all already required in CLAUDE.md; the refactor verifies them).
- Don't log secrets, tokens, passwords, or full personal data.

### 2.5 Mongoose / data access
- Read queries that don't need document methods use `.lean()` and `.select()` projections.
- No N+1: use `populate` with selected fields, `$in` batches or aggregation instead of queries in loops.
- Indexes match the real queries; confirm each list endpoint's filter+sort is covered.
- Atomic conditional updates for state transitions (`findOneAndUpdate` with a status filter), never read-then-write for concurrent-sensitive changes.
- Business rules live in services (or pure functions next to the model), not in schema hooks, except invariants like hashing.
- Return DTOs via explicit serializers (`toAttendanceDTO`) so new schema fields never leak by accident.
- Money/time: store UTC dates; business-date logic goes through the single `time` util.

### 2.6 Logging
- Morgan for HTTP access logs; the project logger for application logs with levels and a consistent `{ message, context }` shape; no stray `console.log` (ESLint `no-console` except in scripts).

### 2.7 Async
- `async/await` only; no callback style; no `.then` chains mixed with `await`; always `await` or intentionally handle every promise (ESLint `no-floating-promises` equivalent: `require-await`, `no-return-await` rules as available); run independent awaits with `Promise.all`.

### 2.8 Lint/format
- Prettier (single config, one command `format` and `format:check`) + ESLint rules: `eqeqeq`, `prefer-const`, `no-var`, `no-console`, `no-unused-vars`, `complexity` (warn 10), `max-depth` (3), `max-lines-per-function` (warn 60, skip comments/blank), `max-lines` (warn 300), `max-params` (4), `no-nested-ternary`, `consistent-return`. Import via `node:` prefix for built-ins.

---

## 3. REST API design

Rules (Microsoft REST guidance; nodebestpractices; project rules marked):
- **Resources are nouns, plural, lowercase kebab-case**: `/users`, `/attendance`, `/notifications`. Avoid verbs in paths.
- **Methods:** `GET` read (safe, idempotent), `POST` create/non-idempotent command, `PUT` full replace, `PATCH` partial update, `DELETE` remove. No state change on `GET`.
- **Status codes:** 200 OK, 201 Created (with `Location` header for created resources), 204 No Content for empty successes, 400 validation, 401 unauthenticated, 403 forbidden, 404 not found, 409 conflict/state violation, 413/415 for uploads, 422 for semantic rule failures, 429 rate limit, 500 unexpected. Never 200 with an error body.
- **One envelope** for success and errors (already defined in CLAUDE.md); error `code` values are stable machine-readable strings, `message` is human-readable.
- **Collections:** pagination (`page`, `limit` with max), filtering and sorting via query params, a `meta` block with totals; never return unbounded lists.
- **Idempotency and concurrency:** state transitions are guarded server-side (conditional updates) so retries and double-clicks are safe.
- **Resource ownership and scope in one place** (shared scope helper), never re-implemented per route.
- **Consistent naming of fields** (camelCase JSON, ISO-8601 UTC timestamps, `YYYY-MM-DD` business dates, ids as strings).
- **Don't expose internals**: no Mongo `__v`, no storage public ids, no password hashes, no stack traces.
- **Versioning and compatibility** (Microsoft guidelines): a published API must not break clients silently. Project rule: keep unversioned `/api` for now and document in the README the policy "breaking changes get a `/api/v2` prefix"; don't add a version prefix in this refactor.
- **Intentional deviations to keep, and document in the README:** command-style sub-resources `POST /attendance/punch-in`, `POST /attendance/punch-out` and `PATCH /attendance/:id/overtime/review` are kept because they represent state-transition commands the frontend already depends on; do not rename them.
- Health endpoint stays public and cheap; it must not leak versions or env details.

Example response helpers:

```js
export const ok = (res, data, meta) => res.status(200).json({ success: true, data, ...(meta && { meta }) });
export const created = (res, data, location) => {
  if (location) res.set('Location', location);
  return res.status(201).json({ success: true, data });
};
```

---

## 4. React + TypeScript

### 4.1 Structure
- Feature folders: `features/<feature>/{api.ts, components/, hooks/, types.ts, utils.ts, index.ts}`; shared UI in `components/ui`, app-wide layout in `components/layout`; pages are thin and compose feature components.
- One exported component per file, file named after it; components ≤ ~150 lines (extract subcomponents/hooks beyond that); no logic-heavy JSX (extract before the `return`).
- Barrel files (`index.ts`) only at feature boundaries, as that feature's public API; no deep imports across features.

### 4.2 Components and hooks
- Separate **what to show** from **how it's computed**: data fetching, derived values and handlers go in custom hooks (`usePunchCard`, `useAttendanceFilters`); the component renders.
- Props: explicit typed interfaces; no `any`; avoid more than ~6 props (group or compose); prefer composition (`children`, slots) to boolean-flag explosions; don't spread unknown props blindly.
- Don't derive state: values computable from props/state are calculated during render, not stored in state and synced by an effect.
- **Effects only for synchronizing with external systems** (socket, geolocation, camera stream, timers, browser APIs). Do NOT use effects to transform data for rendering, to respond to user events, to reset state on prop change (use `key`), or to notify a parent (call it in the event handler). Every effect with a subscription/timer/stream has a cleanup. (React docs: "You Might Not Need an Effect".)
- Live elapsed timer: one interval effect with cleanup, computing from the server timestamp each tick (never accumulate drift locally).
- Memoization: don't sprinkle `useMemo`/`useCallback`/`memo` by default; add only where profiling or referential-equality for a dependency requires it.
- Lists: stable ids as `key`, never array index for dynamic lists.
- Lazy-load route pages with `React.lazy` + `Suspense`; an error boundary around routes; skeletons for loading.
- Accessibility: semantic elements, labels tied to inputs, `aria-live` for async status, focus management in dialogs, visible focus, color never the only cue.

### 4.3 State and data
- Server data lives only in RTK Query; no copies in slices. Local UI state stays in the component (`useState`/`useReducer`). Redux slices only for truly global UI state (session flag, theme).
- One `api` slice, endpoints injected per feature with `injectEndpoints`; tag types defined once as constants; mutations invalidate the narrowest tags; use `transformResponse` to unwrap the `{success, data, meta}` envelope in ONE shared place, not per endpoint.
- Typed hooks: export `useAppDispatch`/`useAppSelector` and use them everywhere; selectors select the smallest slice of state needed.
- Handle `isLoading`, `isError`, empty and success explicitly (shared `<QueryState>` wrapper or hook), never render `undefined` data.
- Error handling: one util `getApiErrorMessage(error)` that understands the server envelope, used by every form/toast.
- Forms: react-hook-form + zod resolver; server field errors mapped with `setError`; disable submit while submitting.

### 4.4 TypeScript
- `strict` on; no `any` (use `unknown` + narrowing); infer types from Zod schemas (`z.infer`); model statuses as string-literal unions or `as const` objects, and use discriminated unions for state machines (`type PunchState = { kind: 'idle' } | { kind: 'inProgress'; since: string } | ...`); no non-null `!` assertions without a comment-worthy reason; shared API types in `types/api.ts`.
- No magic strings for roles/statuses/routes: `ROLES`, `WORKING_STATUS`, `ROUTES` constants.

Example — derived state and effect misuse:

```tsx
// BEFORE
const [filtered, setFiltered] = useState<Row[]>([]);
useEffect(() => { setFiltered(rows.filter(r => r.status === status)); }, [rows, status]);

// AFTER
const filtered = rows.filter(r => r.status === status); // computed during render
```

```tsx
// BEFORE: logic in component
function PunchCard() { /* 200 lines: geolocation, camera, timer, mutation, error mapping, JSX */ }

// AFTER
function PunchCard() {
  const punch = usePunchCard();          // state machine, mutations, error mapping
  return <PunchCardView {...punch} />;   // presentation only
}
```

---

## 5. Testing and tooling hygiene

- Tests mirror modules; AAA structure (arrange, act, assert); one behaviour per test; descriptive names ("rejects punch-in when already punched in"); no tests depending on execution order or real time (inject the clock).
- Test helpers/factories for users, attendance and auth cookies live in `tests/helpers`; no copy-pasted setup.
- Remove `.only`/`.skip` leftovers; no flaky sleeps (use fake timers or deterministic hooks).
- Scripts documented in README; `package.json` has `engines`, `lint`, `format`, `format:check`, `test`, `build`; lockfiles committed; `npm audit --omit=dev` clean or documented.
- EditorConfig + Prettier config shared; line endings consistent (add `.gitattributes` with `* text=auto`).

---

## 6. Master prompt (paste this)

```
You are refactoring the existing Attendance Management System for code quality. Read CLAUDE.md and REFACTOR.md fully first; REFACTOR.md is authoritative for this task. This is a BEHAVIOUR-PRESERVING refactor: no feature changes, no changed API contract, no changed business rules or error codes.

STEP 0 — Baseline and safety net (no refactoring yet)
- Run server and client lint, build and tests. Record the real counts. If anything is red, stop and report it.
- Write `server/tests/contract.test.js` (or equivalent location in the current layout): snapshot the full route table (method, path, allowed roles) and the response envelope shape for one success and one error per module. It must pass now and keep passing after every later step.
- Produce an audit report `REFACTOR_AUDIT.md` with real metrics measured by commands/ESLint, not guesses: files over 300 lines, functions over 50 lines, max nesting depth, cyclomatic complexity hotspots, duplicated logic (list concrete places), direct `process.env` reads outside config, direct model access in controllers, business logic in routes/controllers, `console.log` usage, `any` in client code, `useEffect`s that derive state, components over 150 lines, unused exports/dependencies (use `depcheck` or `knip` via npx, do not install permanently), commented-out code, TODOs. Rank by risk and value. Commit the contract test only (`test: add API contract snapshot`). Do not commit REFACTOR_AUDIT.md unless I ask.

STEP 1 — Tooling (commit: `chore: lint and format rules`)
- Add Prettier (one config for both packages, `format` and `format:check` scripts) and the ESLint rules listed in REFACTOR.md 2.8 for the server and the equivalent TypeScript/React rules for the client (plus `@typescript-eslint/no-explicit-any` and the React hooks rules already present). Set new complexity/size rules to "warn", then fix warnings in later steps. Format the whole repo once in its own commit (`style: apply prettier`) so later diffs stay readable.

STEP 2 — Server structure (commits per module, `refactor(server): <module>`)
- Migrate to the feature-module layout in REFACTOR.md 2.1 one module at a time (auth, users, attendance, overtime, reports, notifications, settings), moving routes/controller/service/validator/model together and updating imports. Keep each commit green. Update `app.js` route mounting only. Update CLAUDE.md section 2 (repository layout) at the end of this step to match reality.
- Enforce the layering rules: controllers call services only; services never see req/res; models have no business logic. Add an ESLint `no-restricted-imports` rule (or `eslint-plugin-boundaries` only if already acceptable) so controllers cannot import models.
- Centralise config: `process.env` only in `config/env.js`; everything else imports the config object.
- Replace magic strings/numbers with constants; replace duplicated scope/authorisation logic with the shared helpers; extract long functions into named steps with guard clauses (example in REFACTOR.md section 1).
- Remove `asyncHandler` only if a test proves Express 5 forwards async rejections to the error handler with the standard envelope; otherwise leave it and note why.
- Introduce explicit DTO serializers for attendance, user, notification and report rows so responses never expose schema internals.
- Mongoose review: `.lean()`/`.select()` on read-only queries, no N+1 loops, indexes cover the real filters/sorts of every list endpoint (list the check per endpoint in the commit message), conditional updates for state transitions.
- Ensure graceful shutdown and process-level error handlers exist and are tested where practical.

STEP 3 — API consistency review (commit: `refactor(server): api consistency`)
- Walk every endpoint against REFACTOR.md section 3: status codes (201 + Location where a resource is created, no 200-with-error), envelope consistency, pagination meta, naming, no leaked internals. Fix inconsistencies only if the client and tests are updated in the same commit and the contract test is updated deliberately, listing each intentional contract change in the commit message. Do NOT rename the command-style routes listed as intentional deviations. Document the deviations and the versioning policy in README.

STEP 4 — Client structure (commits per feature, `refactor(client): <feature>`)
- Apply REFACTOR.md section 4: feature folders with public `index.ts`, thin pages, extract logic into custom hooks (at least: punch flow, attendance filters, review dialog state, notification socket), split components over 150 lines, remove effect misuse (derived state, event-driven effects), add cleanups, use `key` resets, lazy-load route pages with Suspense and an error boundary, one shared envelope-unwrapping `transformResponse`, one `getApiErrorMessage` util, typed `useAppDispatch`/`useAppSelector`, tag constants, `ROLES`/`WORKING_STATUS`/`ROUTES` constants, remove `any`, model punch state as a discriminated union.
- Keep all existing client tests green and add tests for each new hook with real logic.

STEP 5 — Dead code and dependencies (commit: `chore: remove dead code and unused dependencies`)
- Remove unused files, exports, dependencies and commented-out code identified by the audit. Re-run build and tests.

STEP 6 — Docs (commit: `docs: architecture and conventions`)
- Update README (architecture overview matching the new structure, layering rules, conventions, API deviations and versioning policy). Add CLAUDE.md section 17 "Code conventions" summarising REFACTOR.md rules 0, 1, 2.1–2.3, 3 and 4 so future work follows them.

AFTER EVERY STEP: run server and client lint, build and tests; the contract test must be green; fix failures before continuing. Never mix refactor and bug-fix changes: if you find a bug, write a failing test, fix it in a separate `fix:` commit, and list it in the final report.

FINAL REPORT (real data only): before/after metrics table from the audit (files >300 lines, functions >50 lines, complexity warnings, `any` count, effects that derive state, duplicated blocks, unused deps), real test counts before and after, list of intentional contract changes (should be none or tiny), bugs found and fixed separately, things you chose not to change and why, and anything that still needs a human check in the browser.
```
