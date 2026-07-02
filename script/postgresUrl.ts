/** Postgres URL for schema push / migrations (use Supabase *direct* connection, not pooler). */
export function migrationDatabaseUrl(): string {
  return (
    process.env.DIRECT_URL ||
    process.env.DATABASE_URL_UNPOOLED ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL ||
    ""
  );
}

/** Postgres URL for runtime API (use Supabase *pooler* on serverless). */
export function runtimeDatabaseUrl(): string {
  return process.env.DATABASE_URL || "";
}
