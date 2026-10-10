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
- **BUSINESS_TIMEZONE**: `Asia/Kolkata` (default). All work dates and attendance calculated server-side using server clock.
- **Shift Duration**: Standard shift is 480 minutes (8 hours). `>= 480 min` is `completed`, `< 480 min` is `incomplete`.
- **One Record per Day**: Strictly one attendance record per employee per business work date.
- **Overtime**: Allowed only for completed records exceeding 480 minutes. Overtime minutes = time beyond 8 hours.
- **Live Selfies**: Live camera capture only (no file uploads), authenticated and streamed server-side.
- **RBAC**: Three roles (`employee`, `manager`, `admin`). Strict separation of reviewer scopes and administrative controls.
