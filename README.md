# Attendance Management System (MERN)

A full-stack role-based Attendance Management System featuring location tracking, live photo verification, overtime workflows, daily reports with Excel/PDF export, automated shifts, and real-time updates.

## Repository Structure

```
/client   # Frontend (React 19 + Vite + TypeScript + Tailwind CSS + Redux Toolkit)
/server   # Backend (Node.js 20+ + Express 5 + Mongoose + Zod + Socket.IO)
```

## Setup & Running Locally

### Backend (`/server`)
1. `cd server`
2. `cp .env.example .env` (fill in your MongoDB URI and secrets)
3. `npm run dev` (starts on http://localhost:5000)
4. `npm test` (runs backend test suite)
5. `npm run lint` (runs ESLint)

### Frontend (`/client`)
1. `cd client`
2. `cp .env.example .env`
3. `npm run dev` (starts on http://localhost:5173 with proxy to backend)
4. `npm run build` (type-checks and builds bundle)
5. `npm test` (runs frontend test suite)
6. `npm run lint` (runs ESLint)

---

## Assumptions & Rules (per CLAUDE.md)
1. **Manager Self-Attendance**: Manager self-attendance is an implementation assumption (the assignment only describes employee punch-in/out).
2. **Administrative Role**: Admin is strictly an administrative-only role: no punch in/out, no personal attendance records, no overtime requests, and no shift alerts.
3. **Midnight Boundary**: Shifts crossing business midnight are not supported; auto-close at `AUTO_CLOSE_TIME` marks unclosed shifts as missed.
4. **Scope at Request Time**: Authority over pending items is evaluated dynamically at request time (if an employee's manager is reassigned, pending review items move with the employee).
5. **BUSINESS_TIMEZONE**: `Asia/Kolkata` (default). All work dates and attendance calculated server-side using server clock.
6. **One Record per Day**: Strictly one attendance record per employee per business work date.
7. **Floor Minutes & No Breaks**: `workedMinutes = floor((punchOut - punchIn)/60000)`, no break deductions.
8. **Overtime Rule**: Overtime is defined as time worked beyond standard shift duration of 480 minutes (8 hours).
9. **Reviewer Scope Matrix**: Employee records are reviewed by their assigned manager or any admin. Manager records are reviewed by admins only. No one reviews their own records (self-review blocked with 403).
10. **Lazy Auto-Close**: Lazy auto-close at punch-in covers server sleep on free hosting.
11. **Single-Instance Cron**: node-cron scheduled jobs assume a single running backend instance.
12. **Same-Origin Proxy Cookies**: JWT session cookie is first-party via dev proxy locally and Vercel rewrite in production.
13. **Live Selfies**: Live camera capture only (no file uploads), authenticated and streamed server-side through signed Cloudinary proxy.
14. **Dual Onboarding Paths**: Both public signup (controlled by `ALLOW_PUBLIC_REGISTRATION`) and invite-only employee onboarding are supported.
15. **Resend Sandbox Sender**: When using `onboarding@resend.dev`, Resend can deliver testing emails only to the Resend account owner's email address. Any external recipient requires a verified custom domain.
16. **Accepted vs Delivered**: An `accepted` status indicates Resend API accepted and queued the email; actual delivery to inbox is confirmed when `last_event` reports `delivered`.
17. **Webhooks Omission**: Asynchronous push delivery webhooks from Resend are not implemented because they require a publicly reachable HTTPS webhook URL with signature verification.
18. **Zero Simulation / Real Delivery**: Development mode, local simulated links, and fake delivery fallbacks have been completely removed from the entire application. All invitations dispatch real emails through Resend.
19. **APP_BASE_URL & Domains**: Invitation links are built using `new URL('/accept-invitation', APP_BASE_URL)`. Changing `APP_BASE_URL` on the backend host (and matching `CLIENT_ORIGIN`) is how deployed links use the real domain.

---

## Invite-Only Employee Lifecycle & Resend Integration

### 1. Resend Email Service Setup
The portal integrates exclusively with the official [Resend](https://resend.com) Node SDK for transactional email dispatch.

#### Account & API Key Configuration
1. Sign up or log in at [resend.com](https://resend.com).
2. Go to **API Keys** and generate a new key (`re_...`).
   - **Permission Trade-off**:
     - **Sending access (send-only)**: Allows creating and resending emails. Status checks via `resend.emails.get` will return 403 (`EMAIL_STATUS_NOT_PERMITTED`).
     - **Full access**: Allows both sending emails and querying message delivery events (`last_event`). Recommended for admin delivery diagnostics.
3. Add the key to `server/.env`:
   ```bash
   RESEND_API_KEY=re_your_api_key_here
   EMAIL_PROVIDER=resend
   EMAIL_FROM=AMS Portal <onboarding@resend.dev>
   APP_BASE_URL=http://localhost:5173
   ```
   *(Keep secrets confidential. Never commit `.env` to version control).*

#### Manual Verification Smoke Test
Before creating invitations, verify that your API key and sender configuration work using the smoke script:
```bash
cd server
npm run email:smoke -- --to user@example.com --confirm
```
> Both `--to <address>` and `--confirm` flags are mandatory. The script sends one plain test email and outputs only the provider message ID or mapped error code.

---

### 2. Sandbox Sender (`onboarding@resend.dev`) Rules
- When `EMAIL_FROM` uses domain `resend.dev` (e.g. `onboarding@resend.dev`), Resend enforces test sandbox mode.
- **Symptom & 403 Error**: Attempting to send to any address other than your Resend account email fails with Resend 403 `validation_error`. The portal maps this to `EMAIL_SANDBOX_RECIPIENT_RESTRICTED` with actionable guidance: *"Resend's test sender can only deliver to your own Resend account email. Verify a domain at resend.com/domains and set EMAIL_FROM to an address on it to email other people."*

---

### 3. Custom Sending Domain Verification
To email colleagues and team members across any organization:
1. Go to [resend.com/domains](https://resend.com/domains) and add your domain. Resend recommends using a dedicated subdomain such as `notifications.<yourdomain.com>`.
2. Configure DNS records with your DNS provider:
   - **SPF (TXT)**: Authorizes mail server routing.
   - **DKIM (CNAME / TXT)**: Cryptographic signature to pass DMARC and avoid spam folders.
   - **Return-Path (MX / CNAME)**: Bounce handling route.
3. Wait for DNS verification, then update `server/.env`:
   ```bash
   EMAIL_FROM=AMS Portal <invitations@notifications.yourdomain.com>
   ```

---

### 4. Delivery Status Lifecycle & Status Meaning

| Status | Meaning & Details |
|---|---|
| `pending` | Invitation created or queued; send claim in progress. |
| `accepted` | Resend API accepted the request and assigned a `providerMessageId`. **Note: This does not prove inbox delivery.** |
| `failed` | Resend API or network error prevented delivery. Stored under `emailLastError` with mapped error code. |

#### Delivery Events (`emailLastEvent`)
When checking status via `/api/admin/invitations/:id/check-delivery` or the Admin Settings diagnostic panel, Resend's delivery events are mapped:
- **Delivered**: Recipient's mail server accepted message delivery.
- **Bounced**: Delivery rejected by recipient mail server (hard or soft bounce).
- **Complained**: Recipient marked the message as spam.
- **Delayed**: Temporary delivery delay encountered by upstream mail servers.
- **Opened / Clicked**: Recipient engaged with the email.

---

### 5. Resend Free Plan Quotas
- **Daily Limit**: 100 emails / day.
- **Monthly Limit**: 3,000 emails / month.
- **Burst Rate Limit**: 2 requests / second.
Exceeding limits returns HTTP 429 (`EMAIL_RATE_LIMITED` / `EMAIL_QUOTA_EXCEEDED`).

---

### 6. Error-Code Diagnosis Table

| Internal Code | HTTP | Root Cause | Actionable Guidance |
|---|---|---|---|
| `EMAIL_NOT_CONFIGURED` | 503 | `RESEND_API_KEY` unset, empty, or placeholder | Set a real key starting with `re_` in `server/.env` |
| `EMAIL_INVALID_API_KEY` | 502 | Key rejected by Resend with 401 | Verify and replace `RESEND_API_KEY` |
| `EMAIL_SANDBOX_RECIPIENT_RESTRICTED` | 502 | Sender is `resend.dev` and recipient is not account owner | Verify custom domain at `resend.com/domains` and update `EMAIL_FROM` |
| `EMAIL_DOMAIN_NOT_VERIFIED` | 502 | `EMAIL_FROM` domain not verified on Resend | Complete DNS records (DKIM/SPF) on `resend.com/domains` |
| `EMAIL_STATUS_NOT_PERMITTED` | 502 | API key has "Sending access" only; status checks forbidden | Create a "Full access" API key to inspect delivery events |
| `EMAIL_RATE_LIMITED` | 502 | Exceeded 2 req/s burst limit | Wait and retry after cooldown |
| `EMAIL_QUOTA_EXCEEDED` | 502 | Exceeded daily/monthly plan quota | Wait for quota reset or upgrade Resend tier |
| `EMAIL_INVALID_RECIPIENT_OR_PARAMS` | 502 | Invalid email syntax or parameters | Verify recipient email address format |
| `EMAIL_TIMEOUT` | 502 | Request exceeded `EMAIL_SEND_TIMEOUT_MS` (10s) | Retry reuses idempotency key to prevent duplicates |
| `EMAIL_PROVIDER_ERROR` | 502 | Upstream network failure | Check server connectivity to `api.resend.com` |

---

### 7. Tunnels & Deployed Domain Switching
- **Local Dev / Mobile Testing via Tunnel**:
  1. Start tunnel (e.g. `cloudflared tunnel --url http://localhost:5173` or `ngrok http 5173`).
  2. In `client/vite.config.ts`, ensure `server.allowedHosts` includes your tunnel domain if required.
  3. Update `server/.env`:
     ```bash
     APP_BASE_URL=https://your-tunnel.trycloudflare.com
     CLIENT_ORIGIN=https://your-tunnel.trycloudflare.com
     ```
- **Production Deployment (Vercel + Render)**:
  - When your Vercel frontend domain is active (e.g. `https://ams.yourdomain.com`), set:
    ```bash
    APP_BASE_URL=https://ams.yourdomain.com
    CLIENT_ORIGIN=https://ams.yourdomain.com
    ```
    on the Render backend host. All generated invitation links will automatically point to the production Vercel domain.

---

### 8. Endpoints Summary

#### Public Auth & Self-Service
- `GET /api/auth/config` — Public feature flags (`{ publicRegistrationEnabled: boolean }`).
- `POST /api/auth/invitations/request-link` — Self-service invitation request (`{ email }`). Always returns generic 200 to prevent user enumeration. Dispatches in background.
- `POST /api/auth/invitations/validate` — Validate invitation token from URL.
- `POST /api/auth/accept-invitation` — Set password and activate account.

#### Admin Invitation Management & Verification
- `GET /api/admin/invitations/email-status` — Provider configuration overview.
- `POST /api/admin/invitations` — Issue employee/manager invitation.
- `GET /api/admin/invitations` — List invitations with delivery status badges and last events.
- `POST /api/admin/invitations/:id/resend` — Rotate token and resend invitation email.
- `POST /api/admin/invitations/:id/revoke` — Revoke pending invitation.
- `POST /api/admin/invitations/:id/check-delivery` — Check live Resend delivery event.
- `POST /api/admin/email/test` — Send fixed test template to verify delivery.
- `GET /api/admin/email/messages/:providerMessageId` — Retrieve delivery event from Resend.

---

## Leave Management Module

The Leave Management module allows employees and managers to request time off, and provides role-based review queues with overlap protection and attendance conflict preservation.

### Features
1. **Application**: Apply for `annual`, `sick`, `casual`, or `unpaid` leave with date ranges and optional single-date half-day (`first_half` / `second_half`).
2. **Business Day Calculation**: Duration is deterministically computed in `Asia/Kolkata` business timezone, automatically excluding weekends (Monday–Friday work week).
3. **Validation & Protection**:
   - Rejects overlapping leave requests.
   - Prevents managers from approving their own leave (`CANNOT_SELF_REVIEW`).
   - If an employee has no assigned manager, the request escalates to organization Admins.
   - Preserves actual punch-in attendance records if an employee worked on an approved leave date, flagging conflicts for managerial review rather than erasing data.
4. **Lifecycle & Statuses**: `pending`, `approved`, `rejected`, `cancelled` (eligible while still pending).

### Leave Endpoints
- `POST /api/leave` — Submit leave application (`{ leaveType, startDate, endDate, isHalfDay, halfDayPeriod, reason }`).
- `GET /api/leave/me` — List personal leave request history.
- `GET /api/leave/team` — List assigned team leave requests for Manager review.
- `GET /api/leave` — Organization-wide leave requests for Admin oversight.
- `PATCH /api/leave/:id/cancel` — Cancel a pending leave request.
- `PATCH /api/leave/:id/review` — Review leave request (`{ status: 'approved' | 'rejected', remarks }`).

---

## Notifications & Real-Time Updates

- **Persistent MongoDB Store**: Missed punch-in, missed punch-out, auto-close, verification outcomes, overtime reviews, and leave reviews persist in `Notification` collection.
- **Idempotent Cron Alerts**: Scheduled jobs run in `Asia/Kolkata` timezone:
  - Missed Punch-In: Automatically skips non-working days, inactive accounts, Admins, and employees on approved leave.
  - Missed Punch-Out: Alerts open shifts without duplicating.
  - Auto-Close: Closes expired open shifts as missed.
- **Authorized Socket.IO Rooms**:
  - Connection requires JWT token with `purpose="socket"`.
  - Derived rooms: `user:<id>`, `team:<managerId>`, `role:admin`.
  - Client listeners cannot spoof or join unauthorized rooms.
  - Decoupled REST: All workflows function independently if the WebSocket disconnects.

---

## Independent Deployment Instructions

### React Frontend (Vercel / Netlify)
1. Set root directory to `client`.
2. Build command: `npm run build`
3. Output directory: `dist`
4. Environment variables:
   ```env
   VITE_API_URL=https://your-backend-api.onrender.com/api
   ```

### Express Backend (Render)
1. Set root directory to `server`.
2. Build command: `npm install`
3. Start command: `npm start`
4. Environment variables:
   ```env
   NODE_ENV=production
   PORT=5000
   MONGODB_URI=mongodb+srv://...
   JWT_SECRET=min_32_characters_random_secret_key
   CLIENT_ORIGIN=https://your-frontend.vercel.app
   APP_BASE_URL=https://your-frontend.vercel.app
   RESEND_API_KEY=re_...
   ```
