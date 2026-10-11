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

## Assumptions & Rules (per CLAUDE.md)
- **Administrative Role**: Admin is strictly an administrative-only role: no punch in/out, no personal attendance records, no overtime requests, and no shift alerts.
- **Workforce Roles**: `employee` and `manager`. Manager self-attendance is an implementation assumption (the assignment only describes employee punch-in/out).
- **Reviewer Scope Matrix**: Employee records are reviewed by their assigned manager or any admin. Manager records are reviewed by admins only. No one reviews their own records (self-review blocked with 403).
- **Scope at Request Time**: Authority over pending items is evaluated dynamically at request time (if an employee's manager is reassigned, pending review items move with the employee).
- **Unassigned Employees**: Employees with no assigned manager have their overtime requests and review queue routed to active admins.
- **Midnight Boundary**: Shifts crossing business midnight are not supported; auto-close at `AUTO_CLOSE_TIME` marks unclosed shifts as missed.
- **BUSINESS_TIMEZONE**: `Asia/Kolkata` (default). All work dates and attendance calculated server-side using server clock.
- **Shift Duration**: Standard shift is 480 minutes (8 hours). `>= 480 min` is `completed`, `< 480 min` is `incomplete`.
- **One Record per Day**: Strictly one attendance record per employee per business work date.
- **Overtime**: Allowed only for completed records exceeding 480 minutes. Overtime minutes = time beyond 8 hours.
- **Live Selfies**: Live camera capture only (no file uploads), authenticated and streamed server-side through signed proxy.

---

## Invite-Only Employee Lifecycle & Resend Email Integration

### 1. Resend Email Service Setup
The portal integrates with [Resend](https://resend.com) for sending transactional employee invitations.

#### Getting an API Key
1. Sign up or log in at [resend.com](https://resend.com).
2. Navigate to **API Keys** and generate a new key (`re_...`).
3. Add the key to `server/.env`:
   ```bash
   RESEND_API_KEY=re_your_api_key_here
   EMAIL_MODE=resend
   ```
   *(Ensure the key is kept private. Never commit `.env` to version control).*

#### Manual Verification Smoke Test
Before using live invitations in production, test your configuration using the dedicated smoke script:
```bash
cd server
npm run email:smoke -- --to user@example.com --confirm
```
> **Safety Notice:** Both `--to <recipient>` and the explicit `--confirm` flag are mandatory to prevent accidental email dispatch. The script prints only redacted/summary outputs without echoing credentials.

---

### 2. Delivery Mode Matrix

| Mode | Environment Variable | External API Calls | Delivery Status | Dev Activation Link |
|---|---|---|---|---|
| **Development** | `EMAIL_MODE=development` | None | `dev_link` | Displayed once in Admin UI modal & returned in response |
| **Resend** | `EMAIL_MODE=resend` | Dispatches via Resend SDK | `accepted` / `failed` | **Never** returned or exposed in responses/logs |

---

### 3. Sandbox Sender (`onboarding@resend.dev`) Limitations
- **Default Sender:** By default, `EMAIL_FROM` is set to `"AMS Portal <onboarding@resend.dev>"`.
- **Sandbox Recipient Restriction:** Resend's test sender can **only deliver emails to the email address registered with your Resend account**.
- **Automatic Error Detection:** If an invitation is sent to an external address while using the sandbox sender, Resend returns HTTP 403 `validation_error`. The portal automatically translates this into the actionable internal code `EMAIL_SANDBOX_RECIPIENT_RESTRICTED` with instructions to verify a custom domain at `resend.com/domains`.

---

### 4. Custom Sending Domain Verification (DNS Steps)
To send invitations to any employee email address across your organization:
1. Go to **Domains** on [resend.com/domains](https://resend.com/domains) and click **Add Domain**.
2. Add the DNS records provided by Resend to your domain registrar / DNS provider:
   - **SPF (TXT):** Authorizes Resend/Amazon SES mail servers.
   - **DKIM (CNAME / TXT):** Provides cryptographic email signing to prevent spoofing.
   - **Return-Path (MX / CNAME):** Handles delivery route verification.
3. Wait for DNS propagation and click **Verify Domain** in the Resend dashboard.
4. Update `server/.env`:
   ```bash
   EMAIL_FROM="AMS Portal <invitations@yourcompany.com>"
   ```

---

### 5. Resend Free Tier Limits & Quotas
- **Daily Limit:** 100 emails per day.
- **Monthly Limit:** 3,000 emails per month.
- **Burst Rate Limit:** 2 requests per second.
- If limits are exceeded, Resend responds with HTTP 429 (`EMAIL_RATE_LIMITED` / `EMAIL_QUOTA_EXCEEDED`).

---

### 6. Provider Error Diagnosis Table

| Internal Code | HTTP Status | Root Cause | Remediation |
|---|---|---|---|
| `EMAIL_NOT_CONFIGURED` | 500 / 502 | `RESEND_API_KEY` missing or using placeholder `re_xxxxxxxxx` in `resend` mode | Configure a real API key in `server/.env` |
| `EMAIL_INVALID_API_KEY` | 502 | Resend rejected key with HTTP 401 | Rotate and paste a valid API key in `server/.env` |
| `EMAIL_SANDBOX_RECIPIENT_RESTRICTED` | 502 | Sender is `onboarding@resend.dev` and recipient is not your account owner email | Verify a custom sending domain at `resend.com/domains` or use `EMAIL_MODE=development` |
| `EMAIL_DOMAIN_NOT_VERIFIED` | 502 | `EMAIL_FROM` domain has not completed DNS verification | Complete DNS records (SPF, DKIM) on `resend.com/domains` |
| `EMAIL_RATE_LIMITED` | 502 | Exceeded 2 req/sec burst limit | Wait a few seconds before retrying |
| `EMAIL_QUOTA_EXCEEDED` | 502 | Exceeded 100/day or 3,000/month limit | Upgrade Resend tier or wait for quota reset |
| `EMAIL_TIMEOUT` | 502 | Upstream Resend call exceeded timeout (default: 10s) | Check network connectivity; retry automatically reuses idempotency key |
| `EMAIL_PROVIDER_ERROR` | 502 | Network error or unexpected Resend API response | Check network connection or upstream Resend status |

---

### 7. Tunnels & External Access (`ngrok` / `cloudflared`)
When testing the invitation flow with external mobile devices or tunnels:
1. Start your tunnel to the Vite client (e.g., `cloudflared tunnel --url http://localhost:5173` or `ngrok http 5173`).
2. Update `server/.env`:
   ```bash
   APP_BASE_URL=https://your-tunnel-name.trycloudflare.com
   CLIENT_ORIGIN=https://your-tunnel-name.trycloudflare.com
   ```
3. The `originCheck` middleware allows `CLIENT_ORIGIN` for CSRF protection while normalizing trailing slashes automatically.

---

### 8. Webhook Disclaimer
- Transactional invitation tokens are self-contained, high-entropy, and cryptographically hashed (`SHA-256`) in MongoDB with a default 72-hour expiration.
- Real-time delivery tracking is recorded directly upon provider dispatch (`accepted`, `failed`, or `dev_link`). Asynchronous delivery/bounce webhooks are decoupled from the token lifecycle and omitted by design to keep local development friction-free.

---

### 9. Assumptions & Operational Rules
- **Token Security:** Raw invitation tokens are generated using `crypto.randomBytes(32)` and never stored or logged in plain text. Only single-use SHA-256 token hashes are persisted.
- **Resend Idempotency:** Each invitation send attempt generates an idempotency key (`invitation:<id>:attempt:<n>`). If a request times out, the attempt counter is not incremented on retry to guarantee provider deduplication.
- **Resend Cooldown:** Resending an invitation enforces a minimum 60-second cooldown (`INVITATION_RESEND_COOLDOWN_SECONDS`) and a maximum limit of 10 resends (`INVITATION_MAX_RESENDS`).
- **Atomic Lease:** Concurrent sends on the same invitation are prevented via an atomic 30-second `sendingAt` lease returning `409 SEND_IN_PROGRESS`.
- **Public Registration Policy:** Controlled by `ALLOW_PUBLIC_REGISTRATION` (default: `true`, creating `employee` accounts). When set to `false`, open signups return `403 SIGNUP_DISABLED` and the frontend informs users that registration is invitation-only.
- **Account Lifecycles:**
  - `invited`: Record provisioned, awaiting initial password setup.
  - `active`: Normal operational status.
  - `suspended`: Login and API access immediately blocked; historical punch records retained.
  - `deactivated`: Account decommissioned; historical data preserved.

---

### 10. Admin Invitation API Endpoints
- `POST /api/admin/invitations` — Issue employee/manager invitation (Rate limited: 30 / 15 min).
- `GET /api/admin/invitations` — List invitations (filters: `status`, `role`, `search`, pagination).
- `GET /api/admin/invitations/email-status` — Retrieve email provider configuration status.
- `GET /api/admin/invitations/:id` — View single invitation details.
- `POST /api/admin/invitations/:id/resend` — Invalidate previous token and issue a fresh one.
- `POST /api/admin/invitations/:id/revoke` — Revoke a pending invitation.
- `POST /api/auth/invitations/validate` — Validate submitted invitation token (public).
- `POST /api/auth/accept-invitation` — Set password and activate account (public).


