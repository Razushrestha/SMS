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
| `npm run db:generate` | Generate Drizzle migrations |
| `npm run db:migrate` | Apply migrations |

## Notes

- Quotas and subscription status are owned by **NEPATRONIX Platform**; schools only edit GPS retention on Plan.
- Support contact mailto uses `NEXT_PUBLIC_SUPPORT_EMAIL` (default `platform@nepatronix.test`).
