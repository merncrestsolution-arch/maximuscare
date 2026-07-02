# Supabase + Vercel setup (Maximus Care)

Use this when moving off Vercel/Neon Postgres to your own **Supabase** database.

## 1. Create Supabase project

1. Go to [supabase.com](https://supabase.com) → **New project**
2. Pick a region close to your users (e.g. Singapore for Sri Lanka)
3. Save the **database password** (you need it for connection strings)

## 2. Get connection strings

In Supabase: **Project Settings → Database → Connection string**

You need **two** URLs:

| Purpose | Supabase tab | Port | Use for |
|--------|--------------|------|---------|
| **Runtime** (API on Vercel) | **Transaction pooler** | `6543` | `DATABASE_URL` |
| **Migrations** (deploy build) | **Direct connection** | `5432` | `DIRECT_URL` |

**Runtime (`DATABASE_URL`)** — Transaction pooler, mode **Transaction**:

```
postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres
```

Add to the end if not present:

```
?pgbouncer=true
```

**Migrations (`DIRECT_URL`)** — Direct connection:

```
postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
```

Replace `[YOUR-PASSWORD]` with your DB password. URL-encode special characters in the password (`@` → `%40`, etc.).

## 3. Configure Vercel environment variables

**Vercel → your project → Settings → Environment Variables**

### Set (Production + Preview)

| Name | Value |
|------|--------|
| `DATABASE_URL` | Transaction pooler URL (port **6543**) |
| `DIRECT_URL` | Direct connection URL (port **5432**) |
| `JWT_SECRET` | Long random string (32+ characters) |

### Remove or disable old Neon/Vercel Postgres vars

Delete these if they still point at the old database (they can override Supabase):

- `POSTGRES_URL`
- `POSTGRES_PRISMA_URL`
- `POSTGRES_URL_NON_POOLING`
- `DATABASE_URL_UNPOOLED`
- Any `STORAGE_*` Postgres URL from Vercel Storage

Keep only **one** runtime URL: `DATABASE_URL` → Supabase pooler.

## 4. Redeploy

1. **Deployments → Redeploy** latest `main` (or push a small commit)
2. Build runs `drizzle-kit push` using `DIRECT_URL` to create tables on Supabase
3. After deploy, open the app and sign in: `admin@maximuscare.com` / `admin123`

## 5. Fresh database vs existing data

- **New Supabase DB:** deploy creates empty tables; default admin is seeded on first API start.
- **Old data on Neon:** Supabase starts empty. To move data you need a `pg_dump` from the old DB and `psql` restore into Supabase (only if you still have access to the old database).

## 6. Troubleshooting

| Problem | Fix |
|---------|-----|
| Still “data transfer quota” | Old `POSTGRES_URL` / Neon `DATABASE_URL` still set — remove them |
| Build fails on `drizzle-kit push` | Set `DIRECT_URL` (port 5432), not pooler |
| Login 500 after deploy | Check Vercel **Functions** logs; confirm `DATABASE_URL` is pooler URL |
| SSL errors | Supabase hosts are auto-detected; URL must contain `supabase` |

## Local development (optional)

```bash
# .env
DATABASE_URL=postgresql://postgres:...@db.xxxx.supabase.co:5432/postgres
JWT_SECRET=local-dev-secret
npm run dev
```

For local dev you can use the **direct** URL on port 5432.
