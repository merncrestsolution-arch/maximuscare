# Maximus Care - Clinic Management System

A physiotherapy and rehabilitation clinic management system for multi-branch healthcare operations. Handles patient registration, visit tracking, staff management, attendance, in-patient admissions, appointments, and expenses.

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite 7, Wouter, TanStack Query, Tailwind CSS, Radix UI, Framer Motion, Recharts
- **Backend:** Express 5 (Node.js)
- **Database:** SQLite (local) / PostgreSQL (production) via Drizzle ORM
- **Auth:** Passport.js (local strategy), bcrypt

## Local Development

### Prerequisites

- Node.js 18+
- npm

### Setup

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Push schema (creates SQLite DB at ./data/maximus.db)
npm run db:push

# Start development server
npm run dev
```

The app runs at `http://localhost:5000` (or the port in `.env`).

### Environment Variables (Local)

| Variable        | Default                    | Description                    |
|-----------------|----------------------------|--------------------------------|
| `NODE_ENV`      | development                | Environment mode               |
| `PORT`          | 3000                       | Server port                    |
| `SESSION_SECRET`| (required for production)  | Session encryption key (min 32 chars) |
| `DATABASE_URL`  | (empty = SQLite)           | PostgreSQL URL or SQLite path  |

For local dev, SQLite is used automatically when `DATABASE_URL` is not set or does not start with `postgresql://`.

## Database Migration

```bash
# Push schema to database (creates/updates tables)
npm run db:push

# Generate migrations (PostgreSQL)
npm run db:migrate
```

## Build & Production

```bash
# Build client and server
npm run build

# Start production server
npm start
```

## Railway Deployment

### 1. Create Project

1. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
2. Connect your repository
3. Add a **PostgreSQL** plugin (or use an external PostgreSQL URL)

### 2. Environment Variables

Set these in Railway → Variables:

| Variable        | Required | Description                                      |
|-----------------|----------|--------------------------------------------------|
| `NODE_ENV`      | Yes      | `production`                                    |
| `PORT`          | Auto     | Railway sets this automatically                  |
| `DATABASE_URL`  | Yes      | PostgreSQL connection string (from Railway PG)   |
| `SESSION_SECRET`| Yes      | Random string, min 32 characters                  |
| `VITE_API_URL`  | No       | Leave empty for same-origin (API on same domain) |

### 3. Deploy

Railway will auto-detect `railway.json` and run:

- **Build:** `npm install && npm run build`
- **Start:** `npm start`
- **Health check:** `/api/health`

### 4. Default Login

- **Admin:** admin@maximuscare.com / admin123
- **MD:** md@maximuscare.com / md123

Change these after first login.

## Docker

```bash
docker build -t maximus-care .
docker run -p 3000:3000 -e DATABASE_URL=postgresql://... -e SESSION_SECRET=... maximus-care
```

## Project Structure

```
├── client/           # React frontend
├── server/           # Express backend
├── shared/            # Shared schema (SQLite + PostgreSQL)
├── drizzle/           # Migrations
└── data/              # SQLite data (local)
```

## License

MIT
