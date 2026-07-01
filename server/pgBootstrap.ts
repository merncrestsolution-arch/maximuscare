import pg from "pg";

export function isPostgresDatabaseUrl(url?: string): boolean {
  return /^postgres(ql)?:\/\//i.test(url || process.env.DATABASE_URL || "");
}

function poolSsl(connectionString: string) {
  const needsSsl =
    /sslmode=require/i.test(connectionString) ||
    /neon\.tech|vercel|supabase|amazonaws|render\.com|azure|googleapis/i.test(connectionString);
  const isLocal = /@(localhost|127\.0\.0\.1)/i.test(connectionString);
  return needsSsl && !isLocal ? { rejectUnauthorized: false as const } : undefined;
}

/** Add a Postgres column using the native driver (reliable in Vercel serverless bundles). */
export async function ensurePostgresColumn(
  table: string,
  column: string,
  definition: string,
): Promise<void> {
  const connectionString = process.env.DATABASE_URL || "";
  if (!isPostgresDatabaseUrl(connectionString)) return;

  const pool = new pg.Pool({
    connectionString,
    ssl: poolSsl(connectionString),
  });

  try {
    const { rows } = await pool.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
      [table, column],
    );
    if (rows.length > 0) return;

    await pool.query(`ALTER TABLE "${table}" ADD COLUMN "${column}" ${definition}`);
    console.log(`[pg-bootstrap] added ${table}.${column}`);
  } finally {
    await pool.end();
  }
}

/** Critical columns required by the current Drizzle schema before any branch query. */
export async function ensurePostgresBootColumns(): Promise<void> {
  try {
    await ensurePostgresColumn(
      "branches",
      "verified_by_admin",
      "BOOLEAN NOT NULL DEFAULT FALSE",
    );
  } catch (error) {
    console.warn("[pg-bootstrap] non-fatal column ensure failed:", error);
  }
}
