// Normalize the database connection env var for serverless hosts.
//
// Vercel/Neon integrations inject the Postgres connection under various names
// (POSTGRES_URL, POSTGRES_PRISMA_URL, DATABASE_URL_UNPOOLED, or a custom-prefixed
// name like STORAGE_POSTGRES_URL). Our DB layer only reads DATABASE_URL, so if it's
// missing we discover any Postgres URL present in the environment and map it over.
//
// IMPORTANT: import this BEFORE any module that reads process.env.DATABASE_URL at
// import time (e.g. server/db.ts).

function looksLikePostgres(value: string | undefined): value is string {
  return !!value && /^postgres(ql)?:\/\//i.test(value);
}

if (!looksLikePostgres(process.env.DATABASE_URL)) {
  // Prefer well-known pooled connection strings first.
  const preferredKeys = [
    "POSTGRES_URL",
    "POSTGRES_PRISMA_URL",
    "DATABASE_URL_POOLED",
    "POSTGRES_URL_NON_POOLING",
    "DATABASE_URL_UNPOOLED",
  ];

  let found: string | undefined;
  for (const key of preferredKeys) {
    if (looksLikePostgres(process.env[key])) {
      found = process.env[key];
      break;
    }
  }

  // Fallback: scan every env var (covers custom prefixes). Prefer a pooled URL
  // (avoid *_NON_POOLING / *_UNPOOLED) since serverless reuses connections poorly.
  if (!found) {
    for (const [key, value] of Object.entries(process.env)) {
      if (looksLikePostgres(value)) {
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
