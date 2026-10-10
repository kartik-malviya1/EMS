# PHASES.md — Prompt sequence

How to use: start a fresh Claude Code session per phase (or `/clear`), paste the phase prompt. `CLAUDE.md` is loaded automatically and holds all rules. Each phase ends with a commit. Do not paste the next phase until the current one's checks pass and you've reviewed the report.

Standard footer already included in every prompt: run lint, build (if applicable) and the tests for the phase; fix failures; commit; report.

---

## Phase 0 — Inspect and plan (no feature code)

```
Read CLAUDE.md fully. Then inspect the repository: directory tree, both package.json files, installed deps, scripts, tsconfig, ESLint config, existing source, .gitignore, any .env files.

Deliver, without writing feature code:
1. A table of what exists vs what CLAUDE.md requires (folders, deps, scripts, config).
2. Problems that would block local run or deployment.
3. The exact list of dependencies to install (server and client), checked against what is already installed.
4. Confirmation of the target folder layout (move/rename existing files only if needed, and list every move).

Then perform ONLY the setup work: reorganise folders if required, install missing dependencies, add scripts, add `engines`, create `.gitignore`, `.env.example` files (CLAUDE.md section 13), ESLint config for server (flat config, ESM), Vitest config for server and client, Tailwind + shadcn/ui initialisation, Vite dev proxy `/api` → http://localhost:5000, path alias `@`. Create `server/src/app.js` + `server.js` with only `GET /api/health`, Morgan, Helmet, CORS, JSON parser, and the central error handler and response helpers (CLAUDE.md section 9). Add one passing health test.
Checks: server `npm run lint && npm test`; client `npm run lint && npm run build`. Commit: `chore: project setup`.
Report: what changed, what you installed, anything you could not verify.
```

## Phase 1 — Config, models, authentication

```
Implement CLAUDE.md sections 4 (User, Attendance, Notification, Settings models with all indexes), 5 (constants only), 8 (auth/security) and the auth endpoints in section 9.

Deliver:
- Zod-validated env config (fail fast), DB connection with graceful shutdown, `utils/{ApiError,asyncHandler,response,logger,time}.js` (Luxon helpers: workDate for a given instant, business-day boundaries).
- Middleware: `authenticate` (loads user from DB, rejects inactive), `authorize(...roles)`, `originCheck`, rate limiters, `validate({body,query,params})`, `notFound`, `errorHandler` (maps Zod, Mongoose validation, duplicate key, Multer, JWT errors to the codes in section 9).
- Endpoints: signup, login, logout, me, socket-token.
- Tests: all Auth/RBAC items from CLAUDE.md section 12 that apply at this stage, plus model-level tests (email normalisation, passwordHash never serialised, unique indexes exist).
Checks: lint + tests. Commit: `feat(server): auth and models`.
```

## Phase 2 — User management and seeding

```
Implement the Users endpoints from section 9 with every rule in section 3 ("Admin user management"), and the scripts `seed:admin` and `seed:demo` from section 14 (seed:demo can leave out attendance for now; add it in Phase 3).
Shared helper `services/scope.service.js` exporting `buildScopeFilter(user)` and `canAccessEmployee(user, employeeId)`; unit-test it for all three roles.
Tests: user PATCH rules (last admin, self-demotion, HAS_TEAM_MEMBERS, manager assignment validation, immediate effect of deactivation on an existing session), listing filters and pagination, manager team listing, admin-only access.
Checks: lint + tests. Commit: `feat(server): user management and seeding`.
```

## Phase 3 — Attendance, selfies, geofencing, working hours

```
Implement CLAUDE.md sections 5, 6, 7 and the attendance endpoints: today, me, team, admin list, :id, punch-in, punch-out, selfie streaming.
Deliver: `storage.service.js` (Cloudinary implementation + injectable fake), multer upload middleware with magic-byte check, `settings.service.js` (seed from env, get/update) with `GET/PUT /api/settings/geofence`, `geofence.service.js` (Haversine), `attendance.service.js` (punch-in, punch-out, lazy auto-close, calculateWorkingStatus pure function), `autoClose` service function (the cron comes in Phase 6).
Atomicity: punch-in via unique index + 11000 mapping; punch-out via conditional findOneAndUpdate. Cleanup uploaded image if DB write fails.
Update `seed:demo` to generate 14 days of varied records (completed, incomplete, missed, mixed verification) without real selfies (leave selfie null in demo data and make the UI handle a missing selfie).
Tests: every Attendance, Working Hours and Geofence item from CLAUDE.md section 12, including the 10-way concurrent punch-in test and concurrent punch-out.
Checks: lint + tests. Commit: `feat(server): attendance, selfies, geofencing`.
```

## Phase 4 — Verification and overtime

```
Implement PATCH verification, POST overtime, PATCH overtime review, GET /overtime/pending with the exact rules in CLAUDE.md sections 3 and 5. Use `buildScopeFilter` and a `canReview(reviewer, attendance, employee)` helper (no self-review, manager scope, manager records admin-only).
Make verification and overtime state appear in all attendance responses (`verification`, `overtime` summary objects; hide `publicId`).
Leave notification hooks as calls to `notification.service` stubs that Phase 6 fills in (the stubs must be real functions with unit-testable signatures, not TODO comments).
Tests: the whole "Verification and overtime" block of CLAUDE.md section 12.
Checks: lint + tests. Commit: `feat(server): verification and overtime`.
```

## Phase 5 — Reports, export, dashboard summary

```
Implement `GET /reports/daily`, `GET /reports/daily/export` (xlsx via exceljs, pdf via pdfkit, streamed, 5000-row cap, landscape PDF with page numbers and a header showing date range and generated-at in business time) and `GET /dashboard/summary`, per CLAUDE.md section 9. All three must use `buildScopeFilter`; the report service is the single source for both JSON and export.
Tests: Reports/export block from section 12, plus dashboard summary correctness for each role against seeded data (assert exact numbers).
Checks: lint + tests. Commit: `feat(server): reports, export, dashboard`.
```

## Phase 6 — Notifications, scheduled jobs, Socket.IO

```
Implement CLAUDE.md section 10 completely.
Deliver: notification endpoints, `notification.service.js` (create + emit, recipient resolution rules, idempotency for alerts), the three cron jobs in `server/src/jobs/` with exported pure `run*` functions (testable without cron), Socket.IO server with handshake auth, rooms, `realtime.service.js`, and wiring of events/notifications into the Phase 3/4 services (replace the Phase 4 stubs). Emit only after the DB write has succeeded.
Tests: the Notifications and Socket blocks of section 12 (use socket.io-client in tests), including that a user never receives another user's events and that alerts are not duplicated when a job runs twice.
Checks: lint + tests. Commit: `feat(server): notifications, jobs, realtime`.
```

## Phase 7 — Frontend foundation

```
Implement CLAUDE.md section 11 foundations: store, base RTK Query `api` with `credentials: 'include'`, typed models in `types/`, auth endpoints, session restore via `/auth/me`, 401 handling (clear session, redirect to login with a toast), `ProtectedRoute`, role-based redirect, app shell (sidebar/topbar/mobile sheet), theme system with no-flash dark mode and toggle, login and signup pages (react-hook-form + zod mirroring server password policy), 404 page, error boundary, shared components: StatusBadge (working/verification/overtime), DataTable with pagination, EmptyState, ErrorState, ConfirmDialog, PageHeader, Skeletons.
Tests: ProtectedRoute, StatusBadge mapping, login validation.
Checks: client lint + build + tests. Commit: `feat(client): foundation, auth, theming`.
```

## Phase 8 — Employee experience

```
Implement the employee area: `/employee` and `/employee/history`.
- `CameraCapture` component (CLAUDE.md section 7), `useGeolocation` hook (high accuracy, 15 s timeout, explicit permission/unavailable/timeout error states, no fallback coordinates, shows accuracy).
- Punch card driven by `GET /attendance/today`: states not-punched / in-progress (live elapsed timer computed from the server punch-in time) / completed / incomplete / missed; Punch In and Punch Out buttons enabled only when valid; multipart submission; server error codes (OUTSIDE_GEOFENCE, LOW_LOCATION_ACCURACY, ALREADY_PUNCHED_IN…) mapped to clear messages.
- Summary cards from `/dashboard/summary`, recent history table with filters (date range, status) and pagination, verification status + remarks visible, overtime request dialog (shows max requestable minutes), overtime history, selfie thumbnails via the selfie endpoint.
- Cache invalidation after every mutation per section 11.
Tests: camera stops tracks on unmount, punch buttons enable/disable by state.
Checks: client lint + build + tests; manually verify the flow against the running backend and state exactly what you verified. Commit: `feat(client): employee dashboard and punch flow`.
```

## Phase 9 — Manager and admin experience

```
Implement manager and admin pages from CLAUDE.md section 11.
- Manager: dashboard (summary cards), team attendance with filters (date range, member, statuses), verification queue, pending overtime queue with approve/reject (confirm dialog, remarks), team daily report with export buttons.
- Admin: dashboard, Users page (list, search, role/active filters, edit dialog for role/manager/active with server error mapping, e.g. HAS_TEAM_MEMBERS), system-wide attendance with filters (including user and role), verification queue, overtime queue, daily reports + export, Geofence settings page (map link preview for the office coordinates, "use my current location" button).
- Shared `AttendanceReviewDialog` (selfie side-by-side, coordinates + maps link, geofence info, history of decisions, remarks, Valid/Invalid with required remarks for Invalid).
- Everything driven by API; correct invalidation of Attendance, Overtime, Report, Dashboard tags.
Checks: client lint + build + tests; verify against the running backend and state what you verified. Commit: `feat(client): manager and admin dashboards`.
```

## Phase 10 — Notifications and realtime in the UI

```
Implement the client side of CLAUDE.md section 10: socket client (token fetch, connect, reconnect with fresh token, disconnect on logout), event → RTK Query tag invalidation, notification bell with unread count, dropdown of latest items, `/notifications` page (paginated, mark read, mark all read), toasts via sonner for new notifications, graceful behaviour when the socket is unavailable (polling disabled; manual refetch still works; small connection indicator).
Tests: socket event triggers invalidation (mock the socket), unread badge updates.
Checks: client lint + build + tests; verify two-browser realtime flow (employee requests overtime, manager sees it without refresh) against the running backend and report exactly what you verified. Commit: `feat(client): notifications and realtime`.
```

## Phase 11 — Hardening, docs, deployment config

```
1. Run the full suites; fix everything. List any CLAUDE.md section 12 test that is missing and write it.
2. Security review against CLAUDE.md sections 3, 8 and 9: walk every route and confirm authenticate + authorize + validate + scope. Output a route-by-route table (route, auth, roles, scope check, validator, test covering it). Fix gaps.
3. Run `npm audit --omit=dev` on both packages; report findings; fix what can be fixed without breaking changes.
4. Accessibility pass: keyboard path through punch flow and review dialog; labels; contrast in both themes.
5. Deployment config: `client/vercel.json`, Render settings documented (or `render.yaml`), `.env.example` files complete, production cookie/origin behaviour tested with `NODE_ENV=production` locally, health check, start scripts.
6. Write README.md per CLAUDE.md section 16, truthfully marking each feature done/unverified.
Do NOT claim anything is deployed. List exact remaining manual steps (create Atlas cluster, Cloudinary account, Render service, Vercel project, env vars, seed admin, update rewrite URL).
Checks: all lint/build/tests. Commit: `docs: readme, deployment config, hardening`.
```

## Phase 12 — Final report (after you deploy)

```
The app is now deployed. Frontend: <URL>. Backend: <URL>. Run a smoke test against the live URLs: health check, signup, login, auth/me, one punch-in with a real selfie (I will do the camera part; verify via the API what you can), selfie authorisation (owner OK, other employee 404), report scoping, export download. Report exactly what passed and failed. Fix failures in code/config. Then produce the final report required by the original brief: what was implemented, architecture, models, endpoints, auth decisions, business rules, test results (real counts), lint/build results, incomplete features, env vars, setup, deployment links, remaining manual steps.
```

---

## Notes for you

- Review the plan output of Phase 0 before approving anything; it is the cheapest place to catch a wrong assumption.
- If a phase fails midway, ask for a fix inside that phase rather than starting the next one.
- Commit after each phase passes; if a later phase breaks things, `git diff` against the last commit shows exactly what changed.
- Camera, geolocation and the realtime flow need a real browser check by you; the agent cannot fully verify them.
