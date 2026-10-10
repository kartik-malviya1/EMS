# CLAUDE.md — Attendance Management System (MERN)

Persistent project rules. Read fully before any task. Every decision here is FINAL: do not re-decide, do not ask about them, do not substitute alternatives. If something truly is not covered, make the smallest reasonable choice, record it under "Assumptions" in README.md, and mention it in the phase report.

Source requirements: the "Full-Stack MERN Assessment: Attendance Management System" PDF. All mandatory, good-to-have and bonus features are IN SCOPE.

## 0. Working rules

- Work in the existing repo. Inspect before changing. Preserve existing work. Never create a second app inside an existing one.
- Frontend (Vite + React + TS) and backend (`npm init -y`) are already initialised; verify their actual state, fix config problems.
- One phase at a time (see PHASES.md). Each phase ends with: lint clean, build OK, tests passing, one git commit (Conventional Commits). Do not start the next phase without being told.
- Never fake results: no fabricated test output, deployment links, or "works" claims for untested code. Mark unverified things "UNVERIFIED".
- No unnecessary dependencies. Check `package.json` before installing. No docs instead of code.
- Never commit secrets. `.env` is gitignored; `.env.example` is committed with placeholders only.

## 1. Stack (pinned)

Backend: Node 20+ (set `engines`), Express 5, ES modules, Mongoose 8, Zod, Morgan, bcryptjs (cost 12), jsonwebtoken, cookie-parser, helmet, cors, express-rate-limit, multer (memory storage), cloudinary, luxon, node-cron, socket.io, exceljs, pdfkit, dotenv.
Backend tests: Vitest + Supertest + mongodb-memory-server (standalone, no replica set).
Frontend: React 19 + Vite + TypeScript (strict), Redux Toolkit + RTK Query, react-router-dom, Tailwind CSS + shadcn/ui (Radix) + lucide-react, react-hook-form + @hookform/resolvers + zod, sonner (toasts), socket.io-client, luxon. ESLint. Tests: Vitest + React Testing Library.
Logging: Morgan (`dev` in development, `combined` in production) plus a tiny `utils/logger.js` wrapper over console with levels. No Winston.
Not allowed: Prisma, SQL databases, other state libraries, express-mongo-sanitize (Zod strict schemas already guarantee primitive types; never pass raw `req.body`/`req.query` into a Mongo query).

## 2. Repository layout

```
/client   src/{app,components/{ui,layout,common},features/{auth,attendance,overtime,review,reports,users,notifications,settings,dashboard},hooks,lib,pages,routes,types}
/server   src/{config,models,routes,controllers,services,middleware,validators,utils,jobs,realtime,scripts,tests}  + app.js, server.js
README.md  .gitignore  CLAUDE.md  PHASES.md
```
`app.js` builds the Express app (exported for tests); `server.js` connects DB, starts HTTP + Socket.IO + cron.
Controllers are thin (parse validated input, call service, shape response). Business rules live in services. Models hold schema, validation, indexes only.

## 3. Roles and rules

Roles: `employee`, `manager`, `admin`. Public signup ALWAYS creates `employee` (role in payload is rejected by strict Zod schema).
- All three roles can punch in/out and request overtime for their own attendance.
- Employee has `managerId` → an active `manager`. Manager and admin have `managerId = null` (enforced).
- Reviewers: employee records → that employee's manager OR any admin. Manager records → admins only. Admin records → another admin (never self). If no other admin exists, the record stays pending.
- Nobody reviews (verification or overtime) their own record, regardless of role.
- Manager scope = users with `managerId === manager._id` and `isActive` not required (inactive team members' history stays visible). Out-of-scope access returns `404 NOT_FOUND` (do not reveal existence) for single-resource routes and is silently excluded from lists.
- Backend enforces everything; frontend hiding is only UX.
- Never trust client-supplied: role, employeeId, reviewer, timestamps, workDate, duration, statuses.

Admin user management (`PATCH /api/users/:id`, admin only, strict schema `{name?, role?, managerId?, isActive?}`):
- Admin cannot change own role or deactivate self.
- Cannot demote/deactivate the last active admin.
- Setting role to `manager`/`admin` forces `managerId = null`.
- A manager with active team members cannot be demoted or deactivated → `409 HAS_TEAM_MEMBERS` until members are reassigned.
- `managerId` must reference an existing active manager, must not equal the user's own id; only valid for role `employee`.
- Deactivation takes effect immediately: auth middleware loads the user from DB on every request and rejects inactive users.

## 4. Data models

`User`: name (2–80), email (lowercase, trimmed, unique index), passwordHash (`select: false`), role (enum, default employee), managerId (ref User, default null), isActive (default true), timestamps. `toJSON` strips passwordHash and `__v`.

`Attendance`:
```
employeeId  ObjectId ref User (indexed)
workDate    String 'YYYY-MM-DD' in BUSINESS_TIMEZONE
punchIn  { at: Date, selfie: { publicId, mimeType, bytes }, location: { latitude, longitude, accuracy, distanceFromOfficeMeters, withinGeofence } }
punchOut { same shape, null until punch-out }
workedMinutes Number | null     // integer, floor((out - in)/60000)
workingStatus enum: in_progress | completed | incomplete | missed
closedBy      enum: employee | system | null
verification { status: pending|valid|invalid (default pending), reviewedBy, reviewedAt, remarks,
               history: [{ status, reviewedBy, reviewedAt, remarks }] }
overtime { status: not_requested|pending|approved|rejected (default not_requested), requestedMinutes, reason, requestedAt,
           reviewedBy, reviewedAt, remarks, history: [{ status, requestedMinutes, reason, requestedAt, reviewedBy, reviewedAt, remarks }] }
timestamps
```
Indexes: unique `{employeeId, workDate}`; `{workDate, workingStatus}`; `{employeeId, workDate:-1}`; `{'overtime.status':1, workDate:-1}`; `{'verification.status':1, workDate:-1}`.
`selfie.publicId` is never returned to clients; selfies are only served through the authorised selfie endpoint.

`Notification`: userId, type, title, message, data `{attendanceId?}`, readAt (null), createdAt. Index `{userId, readAt, createdAt:-1}`; TTL index on createdAt = 90 days.
Types: `overtime_requested`, `overtime_approved`, `overtime_rejected`, `attendance_valid`, `attendance_invalid`, `missed_punch_in`, `missed_punch_out`, `attendance_auto_closed`.

`Settings` (single document, `key: 'geofence'`): `{ enabled, officeLatitude, officeLongitude, radiusMeters, maxAccuracyMeters }`. On first boot, seeded from env (`GEOFENCE_*`); afterwards the DB document is the source of truth, editable by admins.

## 5. Business rules (exact)

- Business timezone: `BUSINESS_TIMEZONE` (default `Asia/Kolkata`). `workDate` computed server-side with Luxon from the server clock. All timestamps from the server clock only.
- Standard shift: `STANDARD_SHIFT_MINUTES` = 480. Working days for missed-punch alerts: `WORKING_DAYS` = ISO weekdays (default `1,2,3,4,5`). Punching on non-working days is allowed.
- No break deduction. `workedMinutes = floor((punchOut.at - punchIn.at) / 60000)`. Reject if punchOut ≤ punchIn.
- `>= 480` → `completed`; `< 480` → `incomplete`; open record → `in_progress`; auto-closed → `missed` (workedMinutes 0, `punchOut` null, `closedBy: system`).
- One record per employee per workDate. Punch-in when today's record exists → `409 ALREADY_PUNCHED_IN`. Punch-in while an older open record exists: first auto-close that record (lazy auto-close), then proceed.
- Punch-out: atomic `findOneAndUpdate({ employeeId, workingStatus: 'in_progress' }, { $set: ... }, { new: true })`. If none → `409 NO_OPEN_ATTENDANCE`. Duplicate/concurrent calls: the filter on `in_progress` guarantees only one succeeds.
- Punch-in concurrency: rely on the unique index; map duplicate-key error (11000) to `409 ALREADY_PUNCHED_IN`. No transactions.
- Missed-punch-out jobs apply to records whose `workDate` is before today in business time.
- Verification: reviewable when `workingStatus !== 'in_progress'`. Marking `invalid` requires remarks (5–500 chars). Re-review allowed; every decision is appended to `verification.history`. Reviewer scope per section 3.
- Overtime request eligibility: own record; `workingStatus === 'completed'`; `workedMinutes > 480`; `verification.status !== 'invalid'`; `overtime.status` is `not_requested` or `rejected` (resubmission after rejection allowed; the rejected request is pushed to `overtime.history`); `requestedMinutes` integer, `1 <= n <= workedMinutes - 480`; reason 5–500 chars. Pending or approved → `409 OVERTIME_NOT_REQUESTABLE`.
- Overtime review: only `pending → approved|rejected`; anything else → `409 INVALID_TRANSITION`. Reviewer scope per section 3. Approving when verification is `invalid` → `409 ATTENDANCE_INVALID`. Remarks optional (max 500), required (5–500) on rejection.
- Overtime is an application assumption (time beyond 8 hours); document it in README.

## 6. Geolocation and geofencing

- Client sends `latitude`, `longitude`, `accuracy` (meters). Server validates ranges (lat −90..90, lng −180..180, accuracy ≥ 0).
- If `Settings.enabled`: compute Haversine distance to the office. Reject with `422 OUTSIDE_GEOFENCE` (include `distanceMeters`, `radiusMeters`) if distance > radiusMeters. Reject with `422 LOW_LOCATION_ACCURACY` if `accuracy > maxAccuracyMeters` (default 100). Defaults: radius 200 m, disabled until an admin or env enables it.
- Always store `distanceFromOfficeMeters` and `withinGeofence` when geofencing is enabled; store `null` for both when disabled.
- Admin endpoints `GET/PUT /api/settings/geofence` (strict schema, range-validated).

## 7. Selfie capture and storage

- Client: `getUserMedia({ video: { facingMode: 'user' } })`, `<video>` preview, canvas capture, resize to max 720 px width, JPEG quality 0.8, confirm/retake, stop all tracks on capture/unmount. No `<input type="file">` anywhere. Handle NotAllowedError, NotFoundError, NotReadableError, insecure context.
- Transport: `multipart/form-data` to the punch endpoints; fields `selfie` (file), `latitude`, `longitude`, `accuracy`. multer memory storage, limit 2 MB, 1 file. Server accepts only `image/jpeg`, `image/png`, `image/webp`, and verifies magic bytes (not just the mimetype header).
- Storage: Cloudinary, `type: 'authenticated'` (private), folder `CLOUDINARY_FOLDER/<employeeId>/<workDate>`, `public_id` `punch-in` or `punch-out`. Wrap in `services/storage.service.js` (`uploadSelfie`, `streamSelfie`, `deleteSelfie`); tests use an injected in-memory fake. If DB write fails after upload, delete the uploaded image (best effort, log failure).
- Serving: `GET /api/attendance/:id/selfies/:kind` (`kind` = `punch-in|punch-out`). Server authorises (owner, in-scope manager, admin), builds a Cloudinary signed URL server-side, fetches it and pipes the bytes with `Content-Type` and `Cache-Control: private, max-age=300`. Cloudinary URLs are never sent to the client. The client uses this endpoint as `<img src>`.

## 8. Auth and security

- JWT in HttpOnly cookie `token`: `SameSite=Lax`, `Secure` when `NODE_ENV=production`, path `/`, 12 h expiry, payload `{sub, purpose:'session'}`. No refresh tokens; on expiry the API returns `401 TOKEN_EXPIRED` and the client redirects to login.
- Frontend uses a same-origin `/api` path: Vite dev proxy locally; Vercel `rewrites` in production proxy `/api/*` to the Render backend. So cookies are first-party; no cross-site cookies.
- CSRF defence: SameSite=Lax + `middleware/originCheck.js`: for non-GET/HEAD/OPTIONS requests, if an `Origin` header is present it must equal `CLIENT_ORIGIN`, else `403 BAD_ORIGIN`.
- `trust proxy` = 1 in production (Render).
- Password policy: 8–72 chars, at least one letter and one number. Login returns the same generic `401 INVALID_CREDENTIALS` for unknown email and wrong password; do a dummy bcrypt compare for unknown email.
- Rate limits: login 10 / 15 min per IP+email; signup 5 / hour per IP; punch endpoints 30 / 15 min per user; global 300 / 15 min per IP. JSON body limit 100 kb.
- Helmet defaults; CORS restricted to `CLIENT_ORIGIN` with credentials (needed for dev without proxy and for Socket.IO).
- All request bodies/queries/params validated with Zod `.strict()` schemas in `validators/`; unknown keys rejected. `ObjectId` params validated.
- Centralised error handler; never leak stack traces, hashes, or Cloudinary details in responses.

## 9. API conventions

Success: `{ "success": true, "data": ..., "meta"?: { page, limit, total, totalPages } }`.
Error: `{ "success": false, "error": { "code": "STRING_CODE", "message": "...", "details"?: [...] } }`.
Status codes: 200, 201, 400 `VALIDATION_ERROR`, 401 `UNAUTHENTICATED|TOKEN_EXPIRED|INVALID_CREDENTIALS`, 403 `FORBIDDEN|ACCOUNT_INACTIVE|BAD_ORIGIN`, 404 `NOT_FOUND`, 409 conflict codes, 413 `FILE_TOO_LARGE`, 415 `UNSUPPORTED_MEDIA_TYPE`, 422 location rules, 429 `RATE_LIMITED`, 500 `INTERNAL_ERROR`.
Pagination on every list endpoint: `page` (default 1), `limit` (default 20, max 100). Dates are `YYYY-MM-DD` business dates.

Endpoints (all under `/api`; `A`=any authenticated, role letters E/M/Ad):
```
GET  /health                                     public
POST /auth/signup | /auth/login | /auth/logout   public (logout: A)
GET  /auth/me                                    A
GET  /auth/socket-token                          A   → 60 s JWT {sub, purpose:'socket'}

GET   /users                  Ad  filters: role, search, isActive, managerId, page, limit
GET   /users/team             M   own team members
GET   /users/managers         Ad  active managers (for assignment dropdown)
GET   /users/:id              Ad
PATCH /users/:id              Ad

GET  /attendance/today                           A   own record for today or null
GET  /attendance/me                              A   from, to, workingStatus, page, limit
GET  /attendance/team                            M   from, to, userId, workingStatus, verificationStatus, overtimeStatus
GET  /attendance                                 Ad  same filters + role
GET  /attendance/:id                             A   authorised by scope
POST /attendance/punch-in                        A   multipart
POST /attendance/punch-out                       A   multipart (acts on caller's open record; no id in URL)
GET  /attendance/:id/selfies/:kind               A   authorised by scope
PATCH /attendance/:id/verification               M,Ad  {status: valid|invalid, remarks?}
POST  /attendance/:id/overtime                   A   owner only {requestedMinutes, reason}
PATCH /attendance/:id/overtime/review            M,Ad  {decision: approved|rejected, remarks?}
GET   /overtime/pending                          M,Ad  pending overtime in scope (page, limit)

GET /reports/daily                               A   date OR from+to, userId, page, limit; scoped by role
GET /reports/daily/export?format=xlsx|pdf        A   same filters, same scoping, max 5000 rows
GET /dashboard/summary                           A   role-scoped real counts
GET/PUT /settings/geofence                       Ad only
GET   /notifications  (unreadOnly, page, limit) | GET /notifications/unread-count | PATCH /notifications/:id/read | PATCH /notifications/read-all    A
```
`GET /attendance` and `/attendance/team` scoping is done in one shared `buildScopeFilter(user)` service helper used by attendance, overtime, reports, export and dashboard so scoping can never diverge.

Reports row fields: employeeName, employeeEmail, workDate, punchInAt, punchOutAt, punchInLocation, punchOutLocation, workedMinutes, workedHours (2 dp), workingStatus, verificationStatus, overtimeStatus, hasPunchInSelfie, hasPunchOutSelfie, attendanceId (client builds the selfie URL from it). Response also includes `summary` counts by workingStatus, verificationStatus, overtimeStatus.
Export: Excel and PDF contain the same rows as text columns (location as "lat, lng"); selfies are NOT embedded. Reuse the report service; stream the file.

`GET /dashboard/summary` returns:
- employee: last 30 business days → completedDays, incompleteDays, missedDays, totalWorkedMinutes, pendingOvertime, approvedOvertimeMinutes, invalidDays.
- manager: today → teamSize, punchedIn, notYetPunchedIn, completed, incomplete, pendingVerification, pendingOvertime.
- admin: totalUsers by role, activeUsers, today → punchedIn, completed, incomplete, missed, pendingVerification, pendingOvertime.

## 10. Notifications, jobs and realtime

Notification triggers (created in `notification.service.js`, which also emits over Socket.IO):
- Overtime requested → the employee's manager + all admins (admins only if the requester is a manager/admin; never the requester).
- Overtime approved/rejected → the employee.
- Verification set valid/invalid → the employee.
- Missed punch-in alert → employee, at `MISSED_PUNCH_IN_ALERT_TIME` (default `11:00`) on working days when no record exists for today.
- Missed punch-out alert → employee, at `MISSED_PUNCH_OUT_ALERT_TIME` (default `20:00`) when today's record is still `in_progress`.
- Auto-close → employee + their manager (`attendance_auto_closed`), at `AUTO_CLOSE_TIME` (default `00:10`) for any `in_progress` record with `workDate` < today.
Jobs in `server/src/jobs/` using node-cron with `timezone: BUSINESS_TIMEZONE`, enabled when `ENABLE_CRON=true`. Alerts are idempotent: never create the same alert type for the same user and workDate twice (check before insert). Single-instance assumption is documented. Lazy auto-close at punch-in covers server sleep on free hosting.

Socket.IO (`server/src/realtime/`): client connects directly to `VITE_SOCKET_URL` (Vercel cannot proxy WebSockets) with `auth: { token: <socket-token> }` fetched from `/auth/socket-token`; server verifies `purpose==='socket'`, loads the user, rejects inactive. CORS = `CLIENT_ORIGIN`, credentials true. Rooms: `user:<id>`, plus `role:admin` for admins. Events emitted after the DB write succeeded:
- `notification:new` `{notification}` → recipient's `user:` room.
- `attendance:updated` `{attendanceId}` → employee, their manager, and `role:admin`.
Client: on `attendance:updated` call `api.util.invalidateTags` for attendance/report/dashboard/overtime tags; on `notification:new` invalidate Notification tags and show a toast. On socket reconnect, invalidate all. Token refetched on every reconnect attempt. The app must work (via manual refetch) when the socket is down.

## 11. Frontend

Routes: `/login`, `/signup`, `/` (redirect by role), `/employee`, `/employee/history`, `/manager`, `/manager/review`, `/manager/overtime`, `/manager/reports`, `/admin`, `/admin/users`, `/admin/attendance`, `/admin/review`, `/admin/overtime`, `/admin/reports`, `/admin/settings`, `/notifications`, `*` (404). Manager/admin also have `/employee` so they can punch in. A `ProtectedRoute` component takes `allowedRoles`; the session is restored from `/auth/me` on load (never from stored role).
RTK Query: one `api` slice with `injectEndpoints` per feature; tag types `Me, User, Attendance, Today, Overtime, Report, Dashboard, Notification, Settings`; invalidate precisely after mutations. Redux slices only for UI state that must be global (auth session flag, theme). Do not copy server data into slices.
UI: Tailwind + shadcn/ui, consistent tokens as CSS variables, dark mode via `class` strategy: default follows `prefers-color-scheme`, user toggle persisted in `localStorage` (`theme`), applied before first paint to avoid flash. Layout: sidebar (desktop), top bar + sheet menu (mobile), notification bell with unread badge. Tables: responsive (horizontal scroll or card layout on mobile), loading skeletons, empty states, error states with retry. Confirm dialogs for reject/invalid. Status badges: working (`in_progress`, `completed`, `incomplete`, `missed`), verification, overtime, each with distinct color AND text (never color alone). WCAG basics: labels, focus rings, `aria-live` for toasts and camera errors, keyboard-operable dialogs. Dashboard numbers come only from API.
Selfie review: dialog with punch-in and punch-out images side by side (via the selfie endpoint), coordinates with "Open in maps" link (`https://www.google.com/maps?q=lat,lng`), geofence distance, times, worked minutes, history of past decisions, remarks textarea, Valid / Invalid buttons.

## 12. Testing (minimum required, all must pass)

Backend, with mongodb-memory-server and the fake storage adapter:
Auth/RBAC: signup creates employee and ignores/rejects role; duplicate email 409; wrong password 401; no cookie 401; inactive user 403 on login and on existing token; employee cannot read another's attendance (404); manager cannot read another team (404); employee cannot review verification/overtime (403); admin sees all; role cannot be self-escalated; user PATCH rules (last admin, HAS_TEAM_MEMBERS).
Attendance: punch-in creates; duplicate punch-in 409; punch-out without punch-in 409; duplicate punch-out 409; missing selfie/location 400; invalid coordinates 400; wrong mimetype 415; bad magic bytes 415; oversize 413; server timestamps ignore client-supplied time; concurrent `Promise.all` of 10 punch-ins yields exactly one record and 9 conflicts; concurrent punch-outs yields one success.
Working hours (service unit tests with controlled clock): 479 → incomplete, 480 → completed, 481 → completed, open → in_progress, out ≤ in rejected, auto-close → missed.
Geofence: inside OK, outside 422, low accuracy 422, disabled skips.
Verification/overtime: reviewer scope; no self-review; invalid requires remarks; history appended; overtime eligibility matrix (not completed, ≤ 480, over max minutes, invalid verification, duplicate pending, resubmit after reject OK); only pending can be reviewed; approving invalid-attendance blocked.
Reports/export: scoping per role; required fields; date filter and range; xlsx/pdf export respects scope and returns correct content type.
Notifications: created for each trigger, recipients correct, alerts idempotent, unread count, mark read only own.
Socket: authenticated connect, rejected with bad/expired/wrong-purpose token, event delivered to correct rooms only.
Frontend: ProtectedRoute redirects; status badge mapping; camera component stops tracks on unmount (mocked `getUserMedia`); login form validation.

## 13. Environment variables

`server/.env.example`: `NODE_ENV, PORT, MONGODB_URI, JWT_SECRET, JWT_EXPIRES_IN=12h, CLIENT_ORIGIN, BUSINESS_TIMEZONE=Asia/Kolkata, STANDARD_SHIFT_MINUTES=480, WORKING_DAYS=1,2,3,4,5, CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, CLOUDINARY_FOLDER=attendance, GEOFENCE_ENABLED=false, GEOFENCE_OFFICE_LAT, GEOFENCE_OFFICE_LNG, GEOFENCE_RADIUS_METERS=200, GEOFENCE_MAX_ACCURACY_METERS=100, ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD, ENABLE_CRON=true, MISSED_PUNCH_IN_ALERT_TIME=11:00, MISSED_PUNCH_OUT_ALERT_TIME=20:00, AUTO_CLOSE_TIME=00:10`.
`client/.env.example`: `VITE_API_BASE_URL=/api`, `VITE_SOCKET_URL` (backend origin; `http://localhost:5000` in dev). Validate server env with Zod at startup and fail fast with a clear message.

## 14. Scripts

Server: `dev` (node --watch), `start`, `test`, `lint`, `seed:admin` (idempotent; creates/updates nothing if the admin email exists; reads `ADMIN_*`; refuses weak passwords), `seed:demo` (refuses when `NODE_ENV=production`; creates 1 admin, 2 managers, 6 employees, 14 days of varied attendance using the fake-storage placeholder or skips selfies; password from `DEMO_PASSWORD`).
Client: `dev`, `build`, `lint`, `test`, `preview`.

## 15. Deployment

- Frontend: Vercel. `client/vercel.json` with a rewrite `/api/(.*)` → `https://<RENDER_URL>/api/$1` and an SPA fallback to `/index.html` (rewrite order: `/api` first).
- Backend: Render web service, root `server`, build `npm ci`, start `npm start`, health check `/api/health`, env vars as in section 13, Node version pinned.
- Database: MongoDB Atlas; allow Render outbound access (Atlas network access list; document `0.0.0.0/0` with a strong user password as the free-tier option).
- Render free tier sleeps after inactivity and cron jobs do not run while asleep; document it, mention an external uptime ping on `/api/health`, and note lazy auto-close covers the gap. Vercel rewrite timeouts can hit cold starts; document "open the backend URL first to wake it".
- Never claim a deployment works unless a real request against the live URL succeeded; otherwise list the exact remaining manual steps.

## 16. README must contain

Prerequisites, install, env vars table, MongoDB + Cloudinary setup, running locally, seeding admin/demo, assigning managers (via admin Users page), architecture overview + diagram (text/mermaid), data model summary, API overview, RBAC matrix, business rules, features implemented (checklist: mandatory / good-to-have / bonus, each marked done or not), testing instructions, deployment steps, assumptions, known limitations. Assumptions to list explicitly: BUSINESS_TIMEZONE, one record per employee per day, floor-minutes, no break policy, overtime = time beyond 8 h, all roles may punch, reviewer matrix, lazy auto-close, single-instance cron, same-origin proxy cookies, selfies proxied through the API.
