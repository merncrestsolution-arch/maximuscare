// Normalize the database connection env var for serverless hosts.
//
// Vercel/Neon integrations inject the Postgres connection under various names
// (POSTGRES_URL, POSTGRES_PRISMA_URL, DATABASE_URL_UNPOOLED, or a custom-prefixed
// name like STORAGE_POSTGRES_URL). Our DB layer only reads DATABASE_URL, so if it's
// missing — or is a leftover placeholder — we discover a real Postgres URL present
// in the environment and map it over.
//
// IMPORTANT: import this BEFORE any module that reads process.env.DATABASE_URL at
// import time (e.g. server/db.ts).

function looksLikePostgres(value: string | undefined): value is string {
  return !!value && /^postgres(ql)?:\/\//i.test(value);
}

// Detect the example/placeholder strings that were never real (e.g. the
// "postgresql://USER:PASSWORD@ep-xxxx..." sample). These must NOT be used.
function isPlaceholder(value: string | undefined): boolean {
  if (!value) return false;
  return /USER:PASSWORD|ep-xxxx|your-[a-z-]*host|<[a-z_]+>|example\.com|CHANGE_ME/i.test(value);
}

const current = process.env.DATABASE_URL;
if (!looksLikePostgres(current) || isPlaceholder(current)) {
  // Prefer well-known connection-string env vars first.
  const preferredKeys = [
    "POSTGRES_URL",
    "POSTGRES_PRISMA_URL",
    "DATABASE_URL_POOLED",
    "POSTGRES_URL_NON_POOLING",
    "DATABASE_URL_UNPOOLED",
  ];

  let found: string | undefined;
  for (const key of preferredKeys) {
    const value = process.env[key];
    if (looksLikePostgres(value) && !isPlaceholder(value)) {
      found = value;
      break;
    }
  }

  // Fallback: scan every env var (covers custom prefixes). Prefer a pooled URL
  // (avoid *_NON_POOLING / *_UNPOOLED) since serverless reuses connections poorly.
  if (!found) {
    for (const [key, value] of Object.entries(process.env)) {
      if (looksLikePostgres(value) && !isPlaceholder(value)) {
        found = value;
        if (!/non_pooling|unpooled/i.test(key)) break;
      }
    }
  }

  if (found) {
    process.env.DATABASE_URL = found;
  }
}

export {};
