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

Roles: `employee`, `manager`, `admin`. Initial admin provisioned by `seed:admin` (idempotent, env-driven; never touch existing admin).
- Admin accounts can NEVER be created or granted through signup, invitation acceptance, invitations, or `PATCH /users`. Roles may change only between `employee` and `manager` (employee→manager clears managerId; manager→employee requires no team members, `409 HAS_TEAM_MEMBERS` otherwise). Admin role cannot be granted or removed via the API.
- Public signup ALWAYS creates `employee` (role in payload rejected by strict Zod schema).
- Workforce roles: `employee`, `manager`. Admin is an administrative-only role: no punch in/out, no personal attendance records, no overtime requests, no shift alerts.
- Admin calls to workforce endpoints (`POST /attendance/punch-in`, `POST /attendance/punch-out`, `GET /attendance/today`, `GET /attendance/me`, `POST /attendance/:id/overtime`) return `403 ADMIN_NOT_ELIGIBLE` (checked by shared `requireWorkforce` middleware before upload parsing, with service defence-in-depth).
- Employee has `managerId` → an active `manager` (or null if unassigned). Manager and admin have `managerId = null` (enforced).
- Reviewer matrix: employee records → that employee's manager OR any admin. Manager records → admins only. There are no admin attendance records, so peer-admin review does not exist.
- Nobody reviews (verification or overtime) or resolves (missing punch-out) their own record, regardless of role. Manager self-review is blocked (`403 FORBIDDEN`).
- Manager scope = users with `managerId === manager._id` and `isActive` not required (inactive team members' history stays visible). Out-of-scope access returns `404 NOT_FOUND` (do not reveal existence) for single-resource routes and is silently excluded from lists.
- Employee with no assigned manager: their overtime requests, missing punch-out resolutions, and review queue go to admins only; notification fallback = all active admins.
- Backend enforces everything; frontend hiding is only UX.
- Never trust client-supplied: role, employeeId, reviewer, timestamps, workDate, duration, statuses.

Admin user management (`PATCH /api/users/:id`, admin only, strict schema `{name?, role?, managerId?, isActive?}`):
- Admin cannot change own role or deactivate self.
- Cannot demote/deactivate the last active admin.
- Setting role to `manager` forces `managerId = null`. Setting role to `admin` is rejected with `400 VALIDATION_ERROR` (admin role cannot be granted via API).
- A manager with active or invited team members cannot be demoted or deactivated → `409 HAS_TEAM_MEMBERS` until members are reassigned.
- Deactivating someone (`isActive === false`) while they have an `in_progress` attendance record → `409 OPEN_SHIFT`. Existing history remains in org-wide reports.
- `managerId` must reference an existing active manager, must not equal the user's own id; only valid for role `employee`.
- Deactivation takes effect immediately: auth middleware loads the user from DB on every request and rejects inactive users.

Account lifecycle and onboarding:
- `accountStatus` enum `invited | active | suspended | deactivated` is the source of truth; `isActive === (accountStatus === 'active')` and the two are synchronised in exactly one place (model pre-save hook). Only `active` users can authenticate and count as workforce in dashboards, team sizes, `notYetPunchedIn`, missed-punch alerts and review scope computations.
- `invited` users have no password. Login for them behaves like an unknown account: generic `401 INVALID_CREDENTIALS` with the dummy bcrypt compare. Inactive/suspended/deactivated accounts return `403 ACCOUNT_INACTIVE` (or `403 ACCOUNT_SUSPENDED`).
- Invitations can only grant `employee` or `manager`. Admin accounts are created only by `seed:admin`.
- Manager can invite EMPLOYEES only into their own team (`POST /api/team/invitations`; auto-assigned `managerId = authenticated manager._id`, `invitedByRole: 'manager'`).
- Acceptance NEVER sets or changes managerId, role, email or invitedBy; it only sets password hash, `accountStatus: 'active'`, `isActive: true`, marks invitation accepted, clears token. The User document is the source of truth for managerId (admin reassignments between invite and acceptance are preserved).
- Public signup is controlled by `ALLOW_PUBLIC_REGISTRATION` (default `true`). When true it creates an `employee` with `accountStatus: 'active'`. When false, `POST /auth/signup` returns `403 SIGNUP_DISABLED`. Signup with an email that belongs to ANY user returns `409` duplicate response; signup never claims or overwrites an invited stub account.

## 4. Data models

`User`: name (2–80), email (lowercase, trimmed, unique index), passwordHash (`select: false`), role (enum: employee|manager|admin, default employee), employeeId (string, unique sparse index), department (string), designation (string), dateOfJoining (date or null), managerId (ref User, default null), accountStatus (enum: invited|active|suspended|deactivated, default active/invited), isActive (default true), timestamps. `passwordHash` is required only when `accountStatus === 'active'`. `toJSON` strips passwordHash and `__v`.

`Invitation`:
```
userId                  ObjectId ref User (indexed)
email                   String (lowercase, trimmed, indexed)
role                    enum: employee | manager
invitedBy               ObjectId ref User (indexed)
invitedByRole           enum: admin | manager (snapshot of creator's role)
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
Event types: `INVITATION_CREATED, INVITATION_EMAIL_SENT, INVITATION_EMAIL_FAILED, INVITATION_RESENT, INVITATION_REVOKED, INVITATION_ACCEPTED, INVITATION_LINK_REQUESTED, EMAIL_TEST_SENT, ACCOUNT_SUSPENDED, ACCOUNT_REACTIVATED, ACCOUNT_DEACTIVATED, ROLE_CHANGED, MANAGER_CHANGED, ATTENDANCE_CORRECTED`. Audit entries never contain passwords, raw tokens or token-bearing URLs.

`Attendance`:
```
employeeId  ObjectId ref User (indexed)
workDate    String 'YYYY-MM-DD' in BUSINESS_TIMEZONE
schedule    { shiftStart: String, shiftEnd: String, expectedMinutes: Number, graceMinutes: Number, timezone: String } // Snapshot at creation
punchIn     { at: Date, selfie: { publicId, mimeType, bytes }, location: { latitude, longitude, accuracy, distanceFromOfficeMeters, withinGeofence } } | null // Optional ONLY when workingStatus === 'missed'
punchOut    { same shape, null until punch-out }
workedMinutes Number | null     // integer, floor((out - in)/60000); null for in_progress, missed, and flagged records
workingStatus enum: in_progress | completed | incomplete | missed
closedBy    enum: employee | reviewer | system | null // 'system' only for tick-created missed records
late        { isLate: Boolean, minutes: Number } | null // set at punch-in; null on missed and legacy records
exceptions  { missingPunchOut: { flaggedAt: Date | null, resolvedAt: Date | null, resolvedBy: ObjectId | null, reason: String | null } }
corrections [{ type: 'missing_punch_out', newPunchOutAt: Date, reason: String, resolvedBy: ObjectId, resolvedAt: Date }]
verification { status: pending|valid|invalid (default pending), reviewedBy, reviewedAt, remarks,
               history: [{ status, reviewedBy, reviewedAt, remarks }] }
overtime    { status: not_requested|pending|approved|rejected (default not_requested), requestedMinutes, reason, requestedAt,
              reviewedBy, reviewedAt, remarks, history: [{ status, requestedMinutes, reason, requestedAt, reviewedBy, reviewedAt, remarks }] }
timestamps
```
Indexes: unique `{employeeId, workDate}`; `{workDate, workingStatus}`; `{employeeId, workDate:-1}`; `{'overtime.status':1, workDate:-1}`; `{'verification.status':1, workDate:-1}`; `{ 'exceptions.missingPunchOut.flaggedAt': 1, workingStatus: 1 }`.
Serializers add derived `displayStatus`: `missed`, `missing_punch_out` (in_progress with unresolved missingPunchOut.flaggedAt), `in_progress`, `completed`, `incomplete`.

`Notification`: userId, type, title, message, data `{attendanceId?, workDate?}`, readAt (null), createdAt. Index `{userId, readAt, createdAt:-1}`; TTL index on createdAt = 90 days.
Types: `overtime_requested`, `overtime_approved`, `overtime_rejected`, `attendance_valid`, `attendance_invalid`, `missed_punch_in`, `missed_shift`, `missing_punch_out`, `invitation_accepted`.

`Settings` (in existing Settings collection):
- Geofence document (`key: 'geofence'`): `{ enabled, officeLatitude, officeLongitude, radiusMeters, maxAccuracyMeters }`.
- Attendance Policy document (`key: 'attendancePolicy'`): `{ shiftStart: '09:00', shiftEnd: '17:00', workingDays: [1,2,3,4,5], expectedMinutes: 480, graceMinutes: 10, punchInWindowMinutes: 240, missingPunchOutAfterMinutes: 15, breakDeductionMinutes: 0, effectiveFrom: String, timezone: 'Asia/Kolkata' }`. On first boot seeded from env + defaults; afterwards DB document is the single source of truth, editable by admins (`GET/PUT /api/settings/attendance-policy`, strict Zod, admin only).

## 5. Business rules (exact)

- Business timezone: `BUSINESS_TIMEZONE` (default `Asia/Kolkata`). `workDate` computed server-side with Luxon from the server clock. All timestamps from server clock only.
- Policy changes apply to FUTURE records only. At record creation, snapshot `schedule {shiftStart, shiftEnd, expectedMinutes, graceMinutes, timezone}` on the attendance document; all later calculations for that record use the snapshot. Ignore workDates before `effectiveFrom` everywhere (no retroactive missed records).
- Lateness: `lateMinutes = max(0, floor((punchIn.at - scheduledStartInstant)/60000))` where `scheduledStartInstant = workDate + snapshot.shiftStart` in the business timezone; `isLate = lateMinutes > graceMinutes`. Early punch-in → 0. On non-working days there is no lateness (`late: { isLate: false, minutes: 0 }`). Lateness never changes workingStatus.
- Working status: `workedMinutes = floor((punchOut.at - punchIn.at) / 60000)`; `>= snapshot.expectedMinutes` → `completed`; `< snapshot.expectedMinutes` → `incomplete`; open → `in_progress`; no break deduction. Reject if punchOut ≤ punchIn.
- Verification: reviewable only when `workingStatus === 'completed' || workingStatus === 'incomplete'`. Marking `invalid` requires remarks (5–500 chars). Re-review allowed; decisions appended to `verification.history`. Reviewer scope per section 3. Missed and in_progress/missing-punch-out records are not reviewable and do not appear in the verification queue.
- Punch-in:
  - Reject with 409 `SHIFT_MARKED_MISSED` if today's record is `missed`.
  - Reject with 409 `PUNCH_IN_WINDOW_CLOSED` on a working day after `shiftStart + punchInWindowMinutes` (message: "The punch-in window has closed. Ask your manager").
  - Reject with 409 `ALREADY_PUNCHED_IN` if today's record already exists.
  - Geofence and selfie checks enforced.
  - A stale open record from a previous day never blocks today's punch-in and is no longer auto-closed; if not yet flagged, flag it lazily at punch-in (`exceptions.missingPunchOut.flaggedAt`).
- Punch-out:
  - Atomic update filter includes `workDate: <today>` (`{ employeeId, workDate: today, workingStatus: 'in_progress' }`) so a stale record can never receive an arbitrary punch-out.
  - If no open record for today but a flagged stale record exists → 409 `MISSING_PUNCH_OUT_NEEDS_CORRECTION` ("Ask your manager or an admin to resolve yesterday's missing punch-out"); otherwise 409 `NO_OPEN_ATTENDANCE`.
  - Shifts crossing business midnight are unsupported.
- Overtime candidate: `max(0, workedMinutes - snapshot.expectedMinutes)`. Request eligible only when `completed`, candidate > 0, verification not invalid; `requestedMinutes <= candidate`; never auto-approved; late arrival does not remove or create overtime.
- Exclusions: users with role employee or manager, accountStatus 'active', dateOfJoining null or ≤ workDate, workDate ≥ effectiveFrom, workDate in workingDays. Admins never. `isExcludedByLeaveOrHoliday(user, workDate)` returns false.
- Reviewer-only correction: `PATCH /api/attendance/:id/resolve-missing-punch-out` (manager, admin; scope per reviewer matrix; never own record; body `{ punchOutAt: ISO datetime, reason: 5–500 chars }`). Allowed only when record is `in_progress` with unresolved flagged exception. PunchOutAt must be on same business workDate, > punchIn.at, and ≤ now. Atomic update sets punchOut {at, selfie null, location null, source: 'reviewer_correction'}, workedMinutes, workingStatus, `closedBy: 'reviewer'`, resolves exception, appends to corrections, AuditLog `ATTENDANCE_CORRECTED`, notifies employee, emits `attendance:updated`. Concurrent double-resolve yields 409 `INVALID_TRANSITION`. Re-evaluates overtime candidates without auto-approving.

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
Status codes: 200, 201, 400 `VALIDATION_ERROR`, 401 `UNAUTHENTICATED|TOKEN_EXPIRED|INVALID_CREDENTIALS`, 403 `FORBIDDEN|ADMIN_NOT_ELIGIBLE|ACCOUNT_INACTIVE|ACCOUNT_SUSPENDED|BAD_ORIGIN|SIGNUP_DISABLED`, 404 `NOT_FOUND`, 409 conflict codes (`ALREADY_PUNCHED_IN|NO_OPEN_ATTENDANCE|HAS_TEAM_MEMBERS|OPEN_SHIFT|INVALID_TRANSITION|INVITATION_ALREADY_PENDING|INVITATION_ALREADY_ACCEPTED|ACCOUNT_ALREADY_ACTIVE|EMPLOYEE_ID_EXISTS|EMAIL_ALREADY_EXISTS|RESEND_LIMIT_REACHED|SEND_IN_PROGRESS|SHIFT_MARKED_MISSED|PUNCH_IN_WINDOW_CLOSED|MISSING_PUNCH_OUT_NEEDS_CORRECTION`), 410 `INVITATION_EXPIRED|INVITATION_REVOKED`, 413 `FILE_TOO_LARGE`, 415 `UNSUPPORTED_MEDIA_TYPE`, 422 location rules, 429 `RATE_LIMITED|RESEND_COOLDOWN` (details.retryAfterSeconds), 500 `INTERNAL_ERROR|INVITATION_STATE_UPDATE_FAILED`, 502 `STORAGE_UNAVAILABLE|EMAIL_INVALID_API_KEY|EMAIL_SANDBOX_RECIPIENT_RESTRICTED|EMAIL_DOMAIN_NOT_VERIFIED|EMAIL_RATE_LIMITED|EMAIL_QUOTA_EXCEEDED|EMAIL_INVALID_RECIPIENT_OR_PARAMS|EMAIL_STATUS_NOT_PERMITTED|EMAIL_TIMEOUT|EMAIL_PROVIDER_ERROR`, 503 `EMAIL_NOT_CONFIGURED`.
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
GET   /users/team             M   team members (including invited, active, suspended) with invitation summaries
GET   /users/managers         Ad  active managers (for assignment dropdown)
GET   /users/:id              Ad
PATCH /users/:id              Ad

POST  /admin/invitations                         Ad  create invitation & provision stub {name, email, role, employeeId?, department?, designation?, managerId?}
GET   /admin/invitations                         Ad  filters: status, role, search, page, limit (returns invitedBy)
GET   /admin/invitations/email-status            Ad  returns {provider: 'resend', configured, senderAddress, senderDomain, sandboxSender, canReadStatus: null}
GET   /admin/invitations/:id                     Ad  view invitation details
POST  /admin/invitations/:id/resend              Ad  rotates token, resets expiry, resends email
POST  /admin/invitations/:id/revoke              Ad  revokes pending invitation
POST  /admin/invitations/:id/check-delivery      Ad  polls Resend API for status of invitation's provider message ID
POST  /admin/email/test                          Ad  sends fixed test template {to}
GET   /admin/email/messages/:providerMessageId   Ad  calls resend.emails.get, returns {id, lastEvent, createdAt, to}

POST  /team/invitations                          M   invite employee to own team {name, email, employeeId?, department?, designation?, dateOfJoining?}
GET   /team/invitations                          M   scoped team invitations (filters: status, search, page, limit)
GET   /team/invitations/:id                      M   view scoped invitation details
POST  /team/invitations/:id/resend               M   resend scoped invitation
POST  /team/invitations/:id/revoke               M   revoke scoped invitation

GET  /attendance/today                           W   own record for today or null (admin → 403 ADMIN_NOT_ELIGIBLE)
GET  /attendance/me                              W   from, to, workingStatus, page, limit (admin → 403 ADMIN_NOT_ELIGIBLE)
GET  /attendance/team                            M   from, to, userId, workingStatus, verificationStatus, overtimeStatus, late, exception
GET  /attendance                                 Ad  same filters + role
GET  /attendance/:id                             A   authorised by scope
POST /attendance/punch-in                        W   multipart (admin → 403 ADMIN_NOT_ELIGIBLE before upload)
POST /attendance/punch-out                       W   multipart (acts on caller's open record; admin → 403 before upload)
GET  /attendance/:id/selfies/:kind               A   authorised by scope (seeded records without selfie → 404)
PATCH /attendance/:id/verification               M,Ad  {status: valid|invalid, remarks?} (no self-review: 403)
POST  /attendance/:id/overtime                   W   owner only {requestedMinutes, reason} (admin → 403 ADMIN_NOT_ELIGIBLE)
PATCH /attendance/:id/overtime/review            M,Ad  {decision: approved|rejected, remarks?} (no self-review: 403)
PATCH /attendance/:id/resolve-missing-punch-out  M,Ad  {punchOutAt, reason} (reviewer scope, no self-resolve: 403)
GET   /overtime/pending                          M,Ad  pending overtime in scope (page, limit)

GET /reports/daily                               A   date OR from+to, userId, page, limit; scoped by role
GET /reports/daily/export?format=xlsx|pdf        A   same filters, same scoping, max 5000 rows (truncated header if >5000)
GET /dashboard/summary                           A   role-scoped real counts (admin summary counts workforce only)
GET/PUT /settings/geofence                       Ad only
GET/PUT /settings/attendance-policy              Ad only (shiftStart, shiftEnd, workingDays, expectedMinutes, graceMinutes, punchInWindowMinutes, missingPunchOutAfterMinutes, breakDeductionMinutes, timezone)
GET   /notifications  (unreadOnly, page, limit) | GET /notifications/unread-count | PATCH /notifications/:id/read | PATCH /notifications/read-all    A
```
`GET /attendance` and `/attendance/team` scoping is done in one shared `buildScopeFilter(user)` service helper used by attendance, overtime, reports, export and dashboard so scoping can never diverge.

Reports row fields: employeeName, employeeEmail, workDate, punchInAt, punchOutAt, punchInLocation, punchOutLocation, workedMinutes, workedHours (2 dp), workingStatus, displayStatus, isLate, lateMinutes, verificationStatus, overtimeStatus, hasPunchInSelfie, hasPunchOutSelfie, attendanceId. Missed rows have blank times and duration.
Export: Excel and PDF contain the same rows with professional presentation; selfies and images are NOT embedded.

`GET /dashboard/summary` returns:
- employee: last 30 business days → completedDays, incompleteDays, missedDays, totalWorkedMinutes, pendingOvertime, approvedOvertimeMinutes, invalidDays.
- manager: today → teamSize, punchedIn (punchIn.at exists), notYetPunchedIn, completed, incomplete, pendingVerification, pendingOvertime, lateCount, missingPunchOutCount, missedCount.
- admin: totalUsers by role, activeUsers, today → punchedIn (punchIn.at exists), completed, incomplete, missed, pendingVerification, pendingOvertime, lateCount, missingPunchOutCount (counts workforce only; admin has no personal summary).

## 10. Notifications, jobs and realtime

Notification triggers (created in `notification.service.js`, which also emits over Socket.IO):
- Overtime requested → employee's manager (if exists) + all active admins (if requester is a manager or employee has no manager; never requester).
- Overtime approved/rejected → employee.
- Verification set valid/invalid → employee.
- Missed punch-in reminder → employee (now ≥ shiftStart + graceMinutes).
- Missed shift alert → employee + manager/admins (now ≥ shiftStart + punchInWindowMinutes).
- Missing punch-out alert → employee + manager/admins (now ≥ shiftEnd + missingPunchOutAfterMinutes or workDate < today).
- Invitation accepted → inviter + manager (if different from inviter; never the accepted user).

Scheduled evaluation (`attendanceTick` in `server/src/jobs/attendanceTick.job.js`):
- Runs at boot and every 5 minutes (`*/5 * * * *`, timezone `BUSINESS_TIMEZONE`) when `ENABLE_CRON=true`.
- Single idempotent job evaluates thresholds against the active DB policy document over the last 3 business days (catch-up after server sleep; never older than 3 days, never before `effectiveFrom`).
- Stage 1: Reminder notification `missed_punch_in` to employee with no record for the day.
- Stage 2: Final cutoff creates `missed` attendance document (`punchIn: null`, `punchOut: null`, `workedMinutes: null`, `closedBy: 'system'`, snapshot `schedule`), sends notification `missed_shift` to employee and manager (admins if no manager).
- Stage 3: Missing punch-out flags in_progress records with `exceptions.missingPunchOut.flaggedAt`, sends notification `missing_punch_out` to employee and manager.
- Retires old jobs `autoClose`, `missedPunchIn`, `missedPunchOut` and lazy auto-close-to-missed behavior.

Socket.IO (`server/src/realtime/`):
- `notification:new` `{notification}` → recipient's `user:` room.
- `attendance:updated` `{attendanceId}` → employee, their manager, and `role:admin`.
- On `invitation_accepted` notification: client invalidates User, Invitation, and Dashboard tags so team lists refresh without reload.

## 11. Frontend

Routes: `/login`, `/signup`, `/request-invitation`, `/accept-invitation`, `/`, `/employee`, `/employee/history`, `/manager`, `/manager/team`, `/manager/review`, `/manager/overtime`, `/manager/reports`, `/admin`, `/admin/users`, `/admin/attendance`, `/admin/review`, `/admin/overtime`, `/admin/reports`, `/admin/settings`, `/notifications`, `*` (404).
Workforce portal routes `/employee*` allow roles: `employee`, `manager`. Admin is never a workforce user: admin is redirected to `/admin`.
Manager team page (/manager/team): table of team members with status badges (Invited / Active / Suspended) and real email delivery state; "Invite Employee" dialog (fields: name, email, employeeId, department, designation, dateOfJoining; role and manager hidden); Resend/Revoke row actions for invited members.
Admin Users page (/admin/users): shows Reporting manager column and Invited by for invited users; Invite dialog with role selection (employee/manager) and optional manager assignment; reassignment controls.
Admin Settings page (/admin/settings): "Attendance policy" card with shiftStart, shiftEnd, workingDays, expectedMinutes, graceMinutes, punchInWindowMinutes, missingPunchOutAfterMinutes, inline validation, and notice "Changes apply to new attendance records only".
Review UI: "Resolve missing punch-out" dialog for managers and admins to resolve flagged in-progress exceptions with datetime input bounded to record workDate and required reason.
Reports & exports: A4 landscape PDF with KPI cards, horizontal distribution bar, validity/overtime tables, repeating headers, colored pills meeting 4.5:1 contrast, footers with page numbers; Excel export with Summary and Records sheets; zero AI controls or text.

## 12. Testing (minimum required, all must pass)

Backend (Vitest + Supertest + mongodb-memory-server):
- Auth/RBAC, User management, Workforce gating, Reviewer matrix (no self-review, out-of-scope 404).
- Attendance policy & rules with injectable clock:
  - Policy examples (09:00-17:00, grace 10, expected 480): completed not late, completed late, incomplete late, completed with overtime candidate, reminder at 09:10, punch-in window closure at 13:01 (409 PUNCH_IN_WINDOW_CLOSED), missed shift at 13:00 (409 SHIFT_MARKED_MISSED on punch-in attempt), missing punch-out flagged (never missed, no duration).
  - Boundary 479/480/481; verification not allowed on missed or flagged records; overtime request blocked on non-completed shifts.
  - Tick idempotency: run twice yields 1 notification and 1 missed record per user/day; concurrent ticks and punch-ins yield no duplicates; tick catch-up for previous day and nothing older than 3 days.
  - Reviewer resolve endpoint: scope checks, self-resolve blocked, time validation, atomic double-resolve, AuditLog entry, employee notified.
  - Null-safety: every consumer of `punchIn` tested with missed records (reports, export, dashboard, selfie, overtime).
- Onboarding & team invitations:
  - Admin invites employee (with manager) and manager; invalid managerId rejected; admin role rejected.
  - Manager invites employee to own team; manipulated payload (role/managerId) rejected; cannot invite managers/admins; scope isolation; duplicate handling (409 EMAIL_ALREADY_EXISTS / INVITATION_ALREADY_PENDING); acceptance preserves managerId; suspended manager gets 403; cannot suspend manager with invited members.
  - End-to-end automated flow from admin provisioning to manager invite, employee acceptance, punch-in, and review.
- Reports and exports:
  - Unit tests for `report.format.js` formatters.
  - PDF and Excel exports: assert content types, filenames, correct page numbers ("Page 1 of N"), absence of raw enums and markdown tokens, WCAG 4.5:1 contrast ratios on pills, no images/selfies.

## 13. Environment variables

`server/.env.example`: `NODE_ENV, PORT, MONGODB_URI, JWT_SECRET, JWT_EXPIRES_IN=12h, CLIENT_ORIGIN, BUSINESS_TIMEZONE=Asia/Kolkata, STANDARD_SHIFT_MINUTES=480, WORKING_DAYS=1,2,3,4,5, CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, CLOUDINARY_FOLDER=attendance, GEOFENCE_ENABLED=false, GEOFENCE_OFFICE_LAT, GEOFENCE_OFFICE_LNG, GEOFENCE_RADIUS_METERS=200, GEOFENCE_MAX_ACCURACY_METERS=100, ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD, ENABLE_CRON=true, EMAIL_PROVIDER=resend, RESEND_API_KEY, EMAIL_FROM, EMAIL_REPLY_TO, APP_BASE_URL, INVITATION_EXPIRY_HOURS=72, INVITATION_RESEND_COOLDOWN_SECONDS=60, INVITATION_MAX_RESENDS=10, EMAIL_SEND_TIMEOUT_MS=10000, ALLOW_PUBLIC_REGISTRATION=true`.
(Env vars `MISSED_PUNCH_IN_ALERT_TIME`, `MISSED_PUNCH_OUT_ALERT_TIME`, `AUTO_CLOSE_TIME`, `XAI_*`, `GROQ_*` are retired).
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
