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
- Secrets: never print, log, echo, or include in reports any API key, password, JWT secret, DB URI or raw invitation token; say 'set/unset' instead. If a secret appears in output by accident, stop and tell the user to rotate it.
- If code and CLAUDE.md disagree, the discrepancy is reported; when a code change is intentional, update CLAUDE.md in the same commit.

## 1. Stack (pinned)

Backend: Node 20+ (set `engines`), Express 5, ES modules, Mongoose 9, Zod, Morgan, bcryptjs (cost 12), jsonwebtoken, cookie-parser, helmet, cors, express-rate-limit, multer (memory storage), cloudinary, luxon, node-cron, socket.io, exceljs, pdfkit, resend (official Resend Node SDK), dotenv. Token generation uses Node's built-in `crypto`.
Backend tests: Vitest + Supertest + mongodb-memory-server (standalone, no replica set).
Frontend: React 19 + Vite + TypeScript (strict), Redux Toolkit + RTK Query, react-router-dom, Tailwind CSS + shadcn/ui (Radix) + lucide-react, react-hook-form + @hookform/resolvers + zod, sonner (toasts), socket.io-client, luxon. ESLint. Tests: Vitest + React Testing Library.
Logging: Morgan (`dev` in development, `combined` in production) plus a tiny `utils/logger.js` wrapper over console with levels. No Winston.
Not allowed: Prisma, SQL databases, other state libraries, express-mongo-sanitize (Zod strict schemas already guarantee primitive types; never pass raw `req.body`/`req.query` into a Mongo query).

## 2. Repository layout

```
/client   src/{app,components/{ui,layout,common},features/{auth,attendance,overtime,review,reports,users,notifications,settings,dashboard,invitations},hooks,lib,pages,routes,types}
/server   src/{config,models,routes,controllers,services,services/email,middleware,validators,utils,jobs,realtime,scripts,tests}  + app.js, server.js
README.md  .gitignore  CLAUDE.md  PHASES.md
```
`app.js` builds the Express app (exported for tests); `server.js` connects DB, starts HTTP + Socket.IO + cron.
Controllers are thin (parse validated input, call service, shape response). Business rules live in services. Models hold schema, validation, indexes only.

## 3. Roles and rules

Roles: `employee`, `manager`, `admin`. Public signup ALWAYS creates `employee` (role in payload is rejected by strict Zod schema).
- Workforce roles: `employee`, `manager`. Admin is an administrative-only role: no punch in/out, no personal attendance records, no overtime requests, no shift alerts.
- Admin calls to workforce endpoints (`POST /attendance/punch-in`, `POST /attendance/punch-out`, `GET /attendance/today`, `GET /attendance/me`, `POST /attendance/:id/overtime`) return `403 ADMIN_NOT_ELIGIBLE` (checked by shared `requireWorkforce` middleware before upload parsing, with service defence-in-depth).
- Employee has `managerId` → an active `manager` (or null if unassigned). Manager and admin have `managerId = null` (enforced).
- Reviewer matrix: employee records → that employee's manager OR any admin. Manager records → admins only. There are no admin attendance records, so peer-admin review does not exist.
- Nobody reviews (verification or overtime) their own record, regardless of role. Manager self-review is blocked (`403 FORBIDDEN`).
- Manager scope = users with `managerId === manager._id` and `isActive` not required (inactive team members' history stays visible). Out-of-scope access returns `404 NOT_FOUND` (do not reveal existence) for single-resource routes and is silently excluded from lists.
- Employee with no assigned manager: their overtime requests and review queue go to admins only; notification fallback = all active admins.
- Backend enforces everything; frontend hiding is only UX.
- Never trust client-supplied: role, employeeId, reviewer, timestamps, workDate, duration, statuses.

Admin user management (`PATCH /api/users/:id`, admin only, strict schema `{name?, role?, managerId?, isActive?}`):
- Admin cannot change own role or deactivate self.
- Cannot demote/deactivate the last active admin.
- Setting role to `manager`/`admin` forces `managerId = null`.
- A manager with active team members cannot be demoted or deactivated → `409 HAS_TEAM_MEMBERS` until members are reassigned.
- Promoting someone to admin (`role === 'admin'`) or deactivating them (`isActive === false`) while they have an `in_progress` attendance record → `409 OPEN_SHIFT`. Existing history remains in org-wide reports.
- `managerId` must reference an existing active manager, must not equal the user's own id; only valid for role `employee`.
- Deactivation takes effect immediately: auth middleware loads the user from DB on every request and rejects inactive users.

Account lifecycle and onboarding:
- `accountStatus` enum `invited | active | suspended | deactivated` is the source of truth; `isActive === (accountStatus === 'active')` and the two are synchronised in exactly one place (model pre-save hook). Only `active` users can authenticate and count as workforce in dashboards, team sizes, `notYetPunchedIn`, missed-punch alerts and review scope computations.
- `invited` users have no password. Login for them behaves like an unknown account: generic `401 INVALID_CREDENTIALS` with the dummy bcrypt compare (differs from original spec: current code returns `403 ACCOUNT_NOT_ACTIVATED`; [TARGET] is generic `401 INVALID_CREDENTIALS` with dummy compare). Inactive/suspended/deactivated accounts keep `403 ACCOUNT_INACTIVE` (or `403 ACCOUNT_SUSPENDED`). An `invited` employee may already have a `managerId`.
- Account lifecycle state transitions allowed by the system:
  | From | To | Mechanism | Guard / Notes |
  |---|---|---|---|
  | `invited` | `active` | `POST /auth/accept-invitation` | Valid, unexpired, unrevoked token; employee establishes password |
  | `invited` | `active` | `PATCH /users/:id` | Admin direct edit |
  | `active` | `suspended` | `PATCH /users/:id` | Admin only; blocks login/API; cannot self-suspend; cannot suspend last admin; cannot suspend manager with team members (`409 HAS_TEAM_MEMBERS`) or open shift (`409 OPEN_SHIFT`) |
  | `suspended` | `active` | `PATCH /users/:id` | Admin only; restores login/API; logs `ACCOUNT_REACTIVATED` |
  | `active` / `suspended` | `deactivated` | `PATCH /users/:id` | Admin only; permanent deactivation; same guards as suspend (last admin, team members, open shift); logs `ACCOUNT_DEACTIVATED` |
  | `deactivated` | `active` | `PATCH /users/:id` | Admin only; reactivates account; logs `ACCOUNT_REACTIVATED` |
  | `deactivated` | `suspended` | `PATCH /users/:id` | Admin only; logs `ACCOUNT_SUSPENDED` |
- Public signup is controlled by `ALLOW_PUBLIC_REGISTRATION` (default `true`). When true it creates an `employee` with `accountStatus: 'active'`. When false, `POST /auth/signup` returns `403 SIGNUP_DISABLED` and the Signup page says registration is invitation-only. Signup with an email that already belongs to ANY user (including `invited`, `suspended`, `deactivated`) returns the same `409` duplicate response as an existing active user; signup must never claim, activate or overwrite an invited stub account.
- Invitations can only grant `employee` or `manager`. Admin accounts are created only by `seed:admin`. Invited email and role are immutable at acceptance.
- The "Admin user management" `PATCH /users/:id` rules stay; an `isActive` change maps onto `accountStatus` as implemented (`isActive: true` → `active`, `isActive: false` → `deactivated`), and lifecycle actions (suspend, reactivate, deactivate) use the same guards (last admin, HAS_TEAM_MEMBERS, OPEN_SHIFT, no self-modification).

## 4. Data models

`User`: name (2–80), email (lowercase, trimmed, unique index), passwordHash (`select: false`), role (enum, default employee), employeeId (string, unique sparse index), department (string), designation (string), dateOfJoining (date or null), managerId (ref User, default null), accountStatus (enum: invited|active|suspended|deactivated, default active/invited), isActive (default true), timestamps. `passwordHash` is required only when `accountStatus === 'active'`. `toJSON` strips passwordHash and `__v`.

`Invitation`:
```
userId                  ObjectId ref User (indexed)
email                   String (lowercase, trimmed, indexed)
role                    enum: employee | manager
invitedBy               ObjectId ref User
tokenHash               String (SHA-256 hash of a 32-byte random hex token, unique index)
status                  enum: pending | accepted | expired | revoked (default pending, indexed)
expiresAt               Date (indexed)
acceptedAt              Date | null
revokedAt               Date | null
lastSentAt              Date
resendCount             Number (default 0)
emailDeliveryStatus     enum: pending | accepted | failed (default pending; accepted = Resend API accepted the request)
emailProviderMessageId  String | null
emailLastEvent          String | null (e.g. delivered, bounced, delayed, complained)
emailLastEventAt        Date | null
emailLastError          { code, message, at, outcomeUnknown }
emailAttempt            Number (default 0)
sendingAt               Date | null (concurrency lock for in-flight sends)
metadata                { name, employeeId, department, designation, managerId }
timestamps
```
Indexes: unique `{tokenHash: 1}`; `{email: 1, status: 1}`; `{status: 1, expiresAt: 1}`; `{expiresAt: 1}`; `{status: 1, createdAt: -1}`.

`AuditLog`: actorId (ObjectId ref User), actorEmail (string), actorRole (string), action (enum AUDIT_ACTIONS), targetUserId (ObjectId ref User), targetUserEmail (string), invitationId (ObjectId ref Invitation), metadata (Mixed), ipAddress (string), userAgent (string), timestamps. Index `{createdAt: -1}`.
Event types: `INVITATION_CREATED, INVITATION_EMAIL_SENT, INVITATION_EMAIL_FAILED, INVITATION_RESENT, INVITATION_REVOKED, INVITATION_ACCEPTED, INVITATION_LINK_REQUESTED, EMAIL_TEST_SENT, ACCOUNT_SUSPENDED, ACCOUNT_REACTIVATED, ACCOUNT_DEACTIVATED, ROLE_CHANGED, MANAGER_CHANGED`. Audit entries never contain passwords, raw tokens or token-bearing URLs.

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
- CSRF defence: SameSite=Lax + `middleware/originCheck.js`: for non-GET/HEAD/OPTIONS requests, if an `Origin` header is present it must equal `CLIENT_ORIGIN`; additionally, outside production, `http://localhost:5173` and `http://127.0.0.1:5173` are accepted, else `403 BAD_ORIGIN`.
- `trust proxy` = 1 in production (Render).
- Password policy: 8–72 chars, at least one letter and one number. Login returns the same generic `401 INVALID_CREDENTIALS` for unknown email and wrong password; do a dummy bcrypt compare for unknown email.
- Invitation tokens: 32 random bytes (hex), only the SHA-256 hash stored, one-time use, expiry and revocation enforced server side. The raw token appears only in the emailed link. Never in any response, log, audit entry, error, list/detail response or test output. No simulated delivery or development mode links exist anywhere in the app.
- Logger redacts fields named `token`, `authorization`, `apiKey`, `password`.
- Rate limits: login 10 / 15 min per IP+email; signup 5 / hour per IP; punch endpoints 30 / 15 min per user; admin invitation create/resend/revoke 30 / 15 min per admin; `POST /auth/invitations/validate` and `POST /auth/accept-invitation` 20 / 15 min per IP; `POST /auth/invitations/request-link` 5 / hour per IP and 3 / hour per email (SHA-256 hash); `POST /admin/email/test` 5 / hour per admin; `GET /admin/email/messages/:providerMessageId` 30 / 15 min per admin; global 300 / 15 min per IP. JSON body limit 100 kb.
- Helmet defaults; CORS restricted to `CLIENT_ORIGIN` with credentials (needed for dev without proxy and for Socket.IO).
- All request bodies/queries/params validated with Zod `.strict()` schemas in `validators/`; unknown keys rejected. `ObjectId` params validated.
- Centralised error handler; never leak stack traces, hashes, or Cloudinary details in responses.

## 9. API conventions

Success: `{ "success": true, "data": ..., "meta"?: { page, limit, total, totalPages } }`.
Error: `{ "success": false, "error": { "code": "STRING_CODE", "message": "...", "details"?: [...] } }`.
Status codes: 200, 201, 400 `VALIDATION_ERROR`, 401 `UNAUTHENTICATED|TOKEN_EXPIRED|INVALID_CREDENTIALS`, 403 `FORBIDDEN|ADMIN_NOT_ELIGIBLE|ACCOUNT_INACTIVE|ACCOUNT_SUSPENDED|BAD_ORIGIN|SIGNUP_DISABLED`, 404 `NOT_FOUND`, 409 conflict codes (`ALREADY_PUNCHED_IN|NO_OPEN_ATTENDANCE|HAS_TEAM_MEMBERS|OPEN_SHIFT|INVALID_TRANSITION|INVITATION_ALREADY_PENDING|INVITATION_ALREADY_ACCEPTED|ACCOUNT_ALREADY_ACTIVE|EMPLOYEE_ID_EXISTS|RESEND_LIMIT_REACHED|SEND_IN_PROGRESS`), 410 `INVITATION_EXPIRED|INVITATION_REVOKED`, 413 `FILE_TOO_LARGE`, 415 `UNSUPPORTED_MEDIA_TYPE`, 422 location rules, 429 `RATE_LIMITED|RESEND_COOLDOWN` (details.retryAfterSeconds), 500 `INTERNAL_ERROR|INVITATION_STATE_UPDATE_FAILED`, 502 `STORAGE_UNAVAILABLE|EMAIL_INVALID_API_KEY|EMAIL_SANDBOX_RECIPIENT_RESTRICTED|EMAIL_DOMAIN_NOT_VERIFIED|EMAIL_RATE_LIMITED|EMAIL_QUOTA_EXCEEDED|EMAIL_INVALID_RECIPIENT_OR_PARAMS|EMAIL_STATUS_NOT_PERMITTED|EMAIL_TIMEOUT|EMAIL_PROVIDER_ERROR`, 503 `EMAIL_NOT_CONFIGURED`.
Pagination on every list endpoint: `page` (default 1), `limit` (default 20, max 100). Dates are `YYYY-MM-DD` business dates.

Endpoints (all under `/api`; `A`=any authenticated, workforce `W`=E,M, role letters E/M/Ad):
```
GET  /health                                     public
GET  /auth/config                                public → { publicRegistrationEnabled: boolean }
POST /auth/signup | /auth/login | /auth/logout   public (logout: A)
GET  /auth/me                                    A
GET  /auth/socket-token                          A   → 60 s JWT {sub, purpose:'socket'}
POST /auth/invitations/request-link              public {email} → always generic 200 with background dispatch
POST /auth/invitations/validate                 public {token} → safe metadata {valid, email, name, role, department, designation, expiresAt}
POST /auth/accept-invitation                    public {token, password, confirmPassword} → activates account

GET   /users                  Ad  filters: role, search, isActive, managerId, page, limit
GET   /users/team             M   own team members
GET   /users/managers         Ad  active managers (for assignment dropdown)
GET   /users/:id              Ad
PATCH /users/:id              Ad

POST  /admin/invitations                         Ad  create invitation & provision stub {name, email, role, employeeId?, department?, designation?, managerId?}
GET   /admin/invitations                         Ad  filters: status, role, search, page, limit
GET   /admin/invitations/email-status            Ad  returns {provider: 'resend', configured, senderAddress, senderDomain, sandboxSender, canReadStatus: null} (never any secret)
GET   /admin/invitations/:id                     Ad  view invitation details
POST  /admin/invitations/:id/resend              Ad  rotates token, resets expiry, resends email
POST  /admin/invitations/:id/revoke              Ad  revokes pending invitation
POST  /admin/invitations/:id/check-delivery      Ad  polls Resend API for status of invitation's provider message ID
POST  /admin/email/test                          Ad  sends fixed test template {to}
GET   /admin/email/messages/:providerMessageId   Ad  calls resend.emails.get, returns {id, lastEvent, createdAt, to}

GET  /attendance/today                           W   own record for today or null (admin → 403 ADMIN_NOT_ELIGIBLE)
GET  /attendance/me                              W   from, to, workingStatus, page, limit (admin → 403 ADMIN_NOT_ELIGIBLE)
GET  /attendance/team                            M   from, to, userId, workingStatus, verificationStatus, overtimeStatus
GET  /attendance                                 Ad  same filters + role
GET  /attendance/:id                             A   authorised by scope
POST /attendance/punch-in                        W   multipart (admin → 403 ADMIN_NOT_ELIGIBLE before upload)
POST /attendance/punch-out                       W   multipart (acts on caller's open record; admin → 403 before upload)
GET  /attendance/:id/selfies/:kind               A   authorised by scope (seeded records without selfie → 404)
PATCH /attendance/:id/verification               M,Ad  {status: valid|invalid, remarks?} (no self-review: 403)
POST  /attendance/:id/overtime                   W   owner only {requestedMinutes, reason} (admin → 403 ADMIN_NOT_ELIGIBLE)
PATCH /attendance/:id/overtime/review            M,Ad  {decision: approved|rejected, remarks?} (no self-review: 403)
GET   /overtime/pending                          M,Ad  pending overtime in scope (page, limit)

GET /reports/daily                               A   date OR from+to, userId, page, limit; scoped by role
GET /reports/daily/export?format=xlsx|pdf        A   same filters, same scoping, max 5000 rows (truncated header if >5000)
GET /dashboard/summary                           A   role-scoped real counts (admin summary counts workforce only)
GET/PUT /settings/geofence                       Ad only
GET   /notifications  (unreadOnly, page, limit) | GET /notifications/unread-count | PATCH /notifications/:id/read | PATCH /notifications/read-all    A
```
`GET /attendance` and `/attendance/team` scoping is done in one shared `buildScopeFilter(user)` service helper used by attendance, overtime, reports, export and dashboard so scoping can never diverge.
Create invitation returns 201 even if email failed with `data: { invitation: <safe fields>, email: { status: 'accepted'|'failed', providerMessageId?, error? } }`. Resend returns 200 with `{ invitation, email }` on success, or 502 with the mapped error envelope on failure. Raw tokens and dev links are NEVER included in any response.

Reports row fields: employeeName, employeeEmail, workDate, punchInAt, punchOutAt, punchInLocation, punchOutLocation, workedMinutes, workedHours (2 dp), workingStatus, verificationStatus, overtimeStatus, hasPunchInSelfie, hasPunchOutSelfie, attendanceId (client builds the selfie URL from it). Response also includes `summary` counts by workingStatus, verificationStatus, overtimeStatus.
Export: Excel and PDF contain the same rows as text columns (location as "lat, lng"); selfies are NOT embedded. Reuse the report service; stream the file.

`GET /dashboard/summary` returns:
- employee: last 30 business days → completedDays, incompleteDays, missedDays, totalWorkedMinutes, pendingOvertime, approvedOvertimeMinutes, invalidDays.
- manager: today → teamSize, punchedIn, notYetPunchedIn, completed, incomplete, pendingVerification, pendingOvertime.
- admin: totalUsers by role, activeUsers, today → punchedIn, completed, incomplete, missed, pendingVerification, pendingOvertime (counts workforce only; admin has no personal summary).

## 10. Notifications, jobs and realtime

Notification triggers (created in `notification.service.js`, which also emits over Socket.IO):
- Overtime requested → the employee's manager (if exists) + all active admins (if requester is a manager or employee has no manager; never the requester).
- Overtime approved/rejected → the employee.
- Verification set valid/invalid → the employee.
- Missed punch-in alert → ACTIVE employee/manager, at `MISSED_PUNCH_IN_ALERT_TIME` (default `11:00`) on working days when no record exists for today.
- Missed punch-out alert → ACTIVE employee/manager, at `MISSED_PUNCH_OUT_ALERT_TIME` (default `20:00`) when today's record is still `in_progress`.
- Auto-close → workforce user + their manager (`attendance_auto_closed`), at `AUTO_CLOSE_TIME` (default `00:10`) for any `in_progress` record with `workDate` < today. Closes open records of any workforce user (including inactive ones), but sends no notification to inactive users.
- Active workforce scope: missed-punch alerts, auto-close notifications, dashboard `teamSize`/`notYetPunchedIn`, and review scope consider only users with `accountStatus === 'active'` (auto-close still closes open records of any workforce user).
Jobs in `server/src/jobs/` using node-cron with `timezone: BUSINESS_TIMEZONE`, enabled when `ENABLE_CRON=true`. Alerts are idempotent: never create the same alert type for the same user and workDate twice (check before insert). Single-instance assumption is documented. Lazy auto-close at punch-in covers server sleep on free hosting.

Socket.IO (`server/src/realtime/`): client connects directly to `VITE_SOCKET_URL` (Vercel cannot proxy WebSockets) with `auth: { token: <socket-token> }` fetched from `/auth/socket-token`; server verifies `purpose==='socket'`, loads the user, rejects inactive. CORS = `CLIENT_ORIGIN`, credentials true. Rooms: `user:<id>`, plus `role:admin` for admins. Events emitted after the DB write succeeded:
- `notification:new` `{notification}` → recipient's `user:` room.
- `attendance:updated` `{attendanceId}` → employee, their manager, and `role:admin`.
Client: on `attendance:updated` call `api.util.invalidateTags` for attendance/report/dashboard/overtime tags; on `notification:new` invalidate Notification tags and show a toast. On socket reconnect, invalidate all. Token refetched on every reconnect attempt. The app must work (via manual refetch) when the socket is down.

## 11. Frontend

Routes: `/login`, `/signup`, `/request-invitation`, `/accept-invitation` (public; sets `meta referrer no-referrer`; states: no-token friendly panel, loading, valid, expired, revoked, already accepted, invalid, success), `/` (redirect by role), `/employee`, `/employee/history`, `/manager`, `/manager/review`, `/manager/overtime`, `/manager/reports`, `/admin`, `/admin/users`, `/admin/attendance`, `/admin/review`, `/admin/overtime`, `/admin/reports`, `/admin/settings`, `/notifications`, `*` (404).
Workforce portal routes `/employee*` allow roles: `employee`, `manager`. Admin is never a workforce user: admin is redirected to `/admin` and never sees punch UI, "My attendance", employee history, personal summary, or shift timer. Manager sidebar has both team pages and "My attendance".
ProtectedRoute checks `allowedRoles`; session is restored from `/auth/me` on load (never from stored role). If `/auth/me` returns 401 on an unauthenticated visit to `/login`, no toast is shown.
Login page (/login): displays "Request a new link" (→ `/request-invitation`). Shows "Create an account" only when `publicRegistrationEnabled` is true.
Request invitation page (/request-invitation): public self-service form with email input; always displays generic confirmation panel; 60 s cooldown on submit.
Accept invitation page (/accept-invitation): with no token, shows friendly panel ("Open the link from your invitation email, or request a new one") with button to `/request-invitation`. Expired/invalid states offer "Request a new link"; revoked/already accepted states show "This invitation is no longer valid. Contact your administrator."
Signup page (/signup): when `ALLOW_PUBLIC_REGISTRATION=false` or backend returns `403 SIGNUP_DISABLED`, displays "Registration is invitation-only" with button to `/request-invitation`.
RTK Query: one `api` slice with `injectEndpoints` per feature; tag types `Me, User, Attendance, Today, Overtime, Report, Dashboard, Notification, Settings, Invitation, EmailStatus`; invalidate precisely after mutations. Redux slices only for UI state that must be global (auth session flag, theme). Do not copy server data into slices.
UI: Tailwind + shadcn/ui, consistent tokens as CSS variables, dark mode via `class` strategy: default follows `prefers-color-scheme`, user toggle persisted in `localStorage` (`theme`), applied before first paint to avoid flash. Layout: sidebar (desktop), top bar + sheet menu (mobile), notification bell with unread badge. Tables: responsive (horizontal scroll or card layout on mobile), loading skeletons, empty states, error states with retry. Confirm dialogs for reject/invalid. Status badges: working (`in_progress`, `completed`, `incomplete`, `missed`), verification, overtime, each with distinct color AND text (never color alone). WCAG basics: labels, focus rings, `aria-live` for toasts and camera errors, keyboard-operable dialogs. Dashboard numbers come only from API.
Admin Users page features tabs for "Staff Directory" and "Invitations & Onboarding", with an "Invite User" modal dialog.
Email-status UI rules:
- No development mode, no simulated delivery labels ("Dev Link", "Local simulated") and no development link dialog.
- Creation / resend displays real Resend result: accepted → green panel with copyable provider message ID; failed → red error with mapped actionable message and retry button.
- Delivery column: badge (pending / accepted / failed) + `emailLastEvent` chip (Delivered, Bounced, Delayed, etc.) + "Check delivery" icon button (calls `/admin/invitations/:id/check-delivery`).
- Resend button disabled while in flight and during cooldown countdown (from `retryAfterSeconds`).
- Banners: sandbox sender banner when `sandboxSender` is true; red alert banner when email is not configured.
- Admin Settings page: "Email delivery" card showing provider, configured status, sender address, sandbox warning, recipient field (prefilled with admin email), "Send test email" button, and live delivery polling panel (polls `/admin/email/messages/:id` every 5 s for up to 60 s).
Selfie review: dialog with punch-in and punch-out images side by side (via the selfie endpoint), coordinates with "Open in maps" link (`https://www.google.com/maps?q=lat,lng`), geofence distance, times, worked minutes, history of past decisions, remarks textarea, Valid / Invalid buttons.

## 12. Testing (minimum required, all must pass)

Backend, with mongodb-memory-server and the fake storage adapter:
Auth/RBAC: signup creates employee and ignores/rejects role; duplicate email 409; wrong password 401; no cookie 401; inactive user 403 on login and on existing token; employee cannot read another's attendance (404); manager cannot read another team (404); employee cannot review verification/overtime (403); admin sees all; role cannot be self-escalated; user PATCH rules (last admin, HAS_TEAM_MEMBERS, OPEN_SHIFT).
Workforce gating: admin calling punch-in/punch-out/today/me/overtime receives 403 ADMIN_NOT_ELIGIBLE and no attendance document or Cloudinary upload is created.
Reviewer matrix: manager reviewing own record → 403; manager reviewing another manager's team member → 404; manager reviewing a manager's record → 403/404; employee without manager overtime succeeds and notifies all active admins; manager reassignment dynamically transfers scope.
Concurrent double-review: two simultaneous overtime reviews or verification updates on the same record → exactly one transition succeeds, other gets 409 INVALID_TRANSITION.
Attendance: punch-in creates; duplicate punch-in 409; punch-out without punch-in 409; duplicate punch-out 409; missing selfie/location 400; invalid coordinates 400; wrong mimetype 415; bad magic bytes 415; oversize 413; server timestamps ignore client-supplied time; concurrent `Promise.all` of 10 punch-ins yields exactly one record and 9 conflicts; concurrent punch-outs yields one success.
Working hours (service unit tests with controlled clock): 479 → incomplete, 480 → completed, 481 → completed, open → in_progress, out ≤ in rejected, auto-close → missed.
Geofence: inside OK, outside 422, low accuracy 422, disabled skips.
Verification/overtime: reviewer scope; no self-review; invalid requires remarks; history appended; overtime eligibility matrix (not completed, ≤ 480, over max minutes, invalid verification, duplicate pending, resubmit after reject OK); only pending can be reviewed; approving invalid-attendance blocked.
Reports/export: scoping per role; required fields; date filter and range; xlsx/pdf export respects scope and returns correct content type; zero rows returns valid empty file; > 5000 rows capped with header notice.
Notifications: created for each trigger, recipients correct, alerts idempotent, unread count, mark read only own; jobs exclude admins and alerts sent only to active users.
Socket: authenticated connect, rejected with bad/expired/wrong-purpose token, event delivered to correct rooms only.
Invitations & Email:
- Provider injected in tests only (fake provider used strictly in unit tests; zero fake/simulated delivery in running app);
- Unconfigured email → create/resend/test endpoints return 503 EMAIL_NOT_CONFIGURED and create no records;
- Provider called once with expected from/to/subject/html/text and idempotency key `invitation:<id>:attempt:<n>`;
- SDK `{data:{id},error:null}` → accepted + providerMessageId; `{data:null,error:{name,message}}` (not thrown) maps to failed + mapped error code (201 on create, 502 on resend);
- Thrown network error maps to failed EMAIL_PROVIDER_ERROR; timeout maps to EMAIL_TIMEOUT with `outcomeUnknown: true` and retry reuses attempt number;
- Resend 403 sandbox maps to EMAIL_SANDBOX_RECIPIENT_RESTRICTED with actionable guidance; status permission failure maps to EMAIL_STATUS_NOT_PERMITTED;
- Resend success rotates token (old fails, new works); resend failure leaves old token valid;
- Concurrent double resend makes exactly one provider call (the other gets 409 SEND_IN_PROGRESS);
- Cooldown 429 with retryAfterSeconds; max resends 409;
- Public self-service `POST /api/auth/invitations/request-link`: pending invitation triggers background send; unknown or invalid email produces identical 200 generic response without provider call; rate-limited per-email (SHA-256) and per-IP;
- Admin test email: sends fixed template, rate-limited, non-admin 403;
- Message status endpoint: returns only id/lastEvent/createdAt/to; requires valid invitation or test audit reference;
- check-delivery stores `emailLastEvent`; 409 if no provider message id;
- No-leak test: verifies zero raw tokens or API keys appear in logs, responses or audit entries;
- Email template properly escapes hostile recipient/org names;
- Env validation rejects placeholder keys, enforces https non-localhost APP_BASE_URL in production, and rejects removed EMAIL_MODE.
Frontend: ProtectedRoute redirects; status badge mapping; camera component stops tracks on unmount; login footer links per auth config; request-invitation generic panel; accept-invitation friendly fallback; delivery chips; cooldown state; settings email verification panel; zero dev-link UI rendered.

## 13. Environment variables

`server/.env.example`: `NODE_ENV, PORT, MONGODB_URI, JWT_SECRET, JWT_EXPIRES_IN=12h, CLIENT_ORIGIN, BUSINESS_TIMEZONE=Asia/Kolkata, STANDARD_SHIFT_MINUTES=480, WORKING_DAYS=1,2,3,4,5, CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, CLOUDINARY_FOLDER=attendance, GEOFENCE_ENABLED=false, GEOFENCE_OFFICE_LAT, GEOFENCE_OFFICE_LNG, GEOFENCE_RADIUS_METERS=200, GEOFENCE_MAX_ACCURACY_METERS=100, ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD, ENABLE_CRON=true, MISSED_PUNCH_IN_ALERT_TIME=11:00, MISSED_PUNCH_OUT_ALERT_TIME=20:00, AUTO_CLOSE_TIME=00:10, EMAIL_PROVIDER=resend, RESEND_API_KEY, EMAIL_FROM, EMAIL_REPLY_TO, APP_BASE_URL, INVITATION_EXPIRY_HOURS=72, INVITATION_RESEND_COOLDOWN_SECONDS=60, INVITATION_MAX_RESENDS=10, EMAIL_SEND_TIMEOUT_MS=10000, ALLOW_PUBLIC_REGISTRATION=true`.
Validation rules:
- `EMAIL_PROVIDER=resend` is the only supported email provider. `EMAIL_MODE` is removed.
- Server boots even if email settings are missing (attendance keeps working locally), logging a warning that email is not configured.
- When unconfigured, email-sending endpoints return 503 `EMAIL_NOT_CONFIGURED` before creating records.
- Production requires a configured key (starting with `re_` and not the placeholder), valid `EMAIL_FROM`, and an https, non-localhost `APP_BASE_URL`.
- `APP_BASE_URL` is normalised (no trailing slash, no path) and links are built with `new URL('/accept-invitation', base)`.
`client/.env.example`: `VITE_API_BASE_URL=/api`, `VITE_SOCKET_URL` (backend origin; `http://localhost:5000` in dev).

## 14. Scripts

Server: `dev` (node --watch), `start`, `test`, `lint`, `seed:admin`, `seed:demo` (creates 1 admin without attendance, 2 managers, 6 employees, 14 days of varied attendance; password from `DEMO_PASSWORD`), `db:purge-admin-attendance` (`server/src/scripts/purge-admin-attendance.js`), `email:smoke` (`npm run email:smoke -- --to <address> --confirm`: sends one plain test email via Resend, prints provider message ID or mapped error only, refuses without both flags), `db:migrate-invitation-email-status` (dry run by default, `--confirm` writes: legacy `sent` with provider id → `accepted`, legacy records without provider id → `failed` NOT_SENT).
Client: `dev`, `build`, `lint`, `test`, `preview`.

## 15. Deployment

- Frontend: Vercel. `client/vercel.json` with a rewrite `/api/(.*)` → `https://<RENDER_URL>/api/$1` and an SPA fallback to `/index.html` (rewrite order: `/api` first).
- Backend: Render web service, root `server`, build `npm ci`, start `npm start`, health check `/api/health`, env vars as in section 13, Node version pinned.
- Database: MongoDB Atlas; allow Render outbound access (Atlas network access list; document `0.0.0.0/0` with a strong user password as the free-tier option).
- Render free tier sleeps after inactivity and cron jobs do not run while asleep; document it, mention an external uptime ping on `/api/health`, and note lazy auto-close covers the gap. Vercel rewrite timeouts can hit cold starts; document "open the backend URL first to wake it".
- Never claim a deployment works unless a real request against the live URL succeeded; otherwise list the exact remaining manual steps.

## 16. README must contain

Prerequisites, install, env vars table, MongoDB + Cloudinary setup, running locally, seeding admin/demo, assigning managers (via admin Users page), architecture overview + diagram (text/mermaid), data model summary, API overview, RBAC matrix, business rules, features implemented (checklist: mandatory / good-to-have / bonus, each marked done or not), testing instructions, deployment steps, assumptions, known limitations. Assumptions to list explicitly:
1. Manager self-attendance is an implementation assumption (the assignment only describes employee punch-in/out);
2. Admin is administrative-only: no punch-in/out, no personal attendance records, no overtime requests, no shift alerts;
3. Shifts crossing business midnight are not supported (auto-close at AUTO_CLOSE_TIME marks them missed);
4. Scope is evaluated at request time (if a manager is reassigned, authority over pending items moves with the employee);
5. BUSINESS_TIMEZONE (default Asia/Kolkata);
6. One record per employee per day;
7. floor-minutes, no break policy;
8. Overtime = time beyond 8 hours;
9. Reviewer matrix: employee records → manager or admin; manager records → admins only; no self-review;
10. Lazy auto-close covers server sleep;
11. Single-instance cron;
12. Same-origin proxy cookies;
13. Selfies proxied through authenticated API;
14. Invitation onboarding is an additional flow beside public signup (assessment requires signup);
15. With the Resend sandbox sender `onboarding@resend.dev` only the Resend account owner's email can receive mail, any other recipient needs a verified domain;
16. `accepted` means Resend accepted the request, not inbox delivery;
17. Delivery/bounce webhooks are not implemented (need a public URL and signature verification);
18. Zero simulation or fake delivery: development mode is completely removed; real invitation email delivery is performed via Resend;
19. Invitation links use APP_BASE_URL and localhost links only work on the same computer. Changing APP_BASE_URL on the backend host is how deployed links get the real domain.
