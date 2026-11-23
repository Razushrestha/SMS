# NEPATRONIX SMS

School management SaaS inspired by eSkooly’s free web admin, plus RFID, GPS, SMS, and a NEPATRONIX Platform console for subscriptions.

## Stack

- **Web** — Next.js 15 (`apps/web`, port 3000)
- **API** — NestJS (`apps/api`, port 4000)
- **DB** — Neon Postgres via Drizzle (`packages/db`)

## Prerequisites

- Node.js 20+
- A Neon (or other Postgres) database

## Setup

```bash
npm install
cp .env.example .env
```

Fill `.env` with your database URLs and origins. Never commit `.env`.

```bash
npm run db:migrate
npm run dev
```

- App: http://localhost:3000  
- API: http://localhost:4000/api  

## Login (eSkooly-style)

The login screen offers **Admin**, **Employee**, and **Student** only.

### Lahan demo (local seed)

| Role | Identifier | Password |
|------|------------|----------|
| School admin | `admin@lahanacademy.test` | `demo-pass-1` |
| Employee | `raju1` | `raju1` |
| Student | `asha1` | `asha1` |
| Platform | `platform@nepatronix.test` | `platform-pass-1` |

Reset an employee portal login anytime with:

```bash
node scripts/set-employee-portal.mjs raju1 raju1
```

Platform email/password can be overridden with `PLATFORM_ADMIN_EMAIL` / `PLATFORM_ADMIN_PASSWORD`.

- School admin → `/admin`
- Platform → `/platform`
- Student / employee portals → `/admin` (role-scoped)

## Useful scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | API + web together |
| `npm run build` | Production build (db, API, web) |
| `npm run start:api` / `start:web` | Run compiled API (4000) and Next (3000) |
| `npm run db:generate` | Generate Drizzle migrations |
| `npm run db:migrate` | Apply migrations |

## Deploy

1. Set `.env` from `.env.example`. Point `WEB_ORIGIN` at the public web URL and `NEXT_PUBLIC_API_URL` at the public API URL.
2. Apply schema: `npm run db:migrate`
3. Production (HTTPS): `NODE_ENV=production`, `COOKIE_SECURE=1`, `TRUST_PROXY=1` if behind a reverse proxy.
4. Start: `npm run build` then `npm run start:api` and `npm run start:web`, **or** `docker compose up --build`.
5. Load balancer probes: `GET /api/health` (process up) and `GET /api/ready` (Postgres ping).

Login, RFID ingest, and GPS ingest are rate-limited in memory on a single API instance.

## Notes

- Quotas and subscription status are owned by **NEPATRONIX Platform**; schools only edit GPS retention on Plan.
- Support contact mailto uses `NEXT_PUBLIC_SUPPORT_EMAIL` (default `platform@nepatronix.test`).
- The API caches auth/session (~45s) and dashboard summaries (~20s) in memory to cut DB hits; auth clears on logout/subscription changes.
- Heavy maintenance (GPS retention prune) runs on an in-process job queue so page loads stay fast. For multi-instance deploys, move caches and jobs to Redis/BullMQ.
- RFID home, GPS export (10,000 points), and custom reports (5,000 rows) are capped so list/export requests cannot pull unbounded tables.
- GPS live map loads the latest point for every vehicle in one query; RFID cutoff writes absents in a batch.
- Chat unread badges count in SQL. A housekeeping job (every 6 hours) drops expired sessions/support tokens and school audit older than 180 days.
