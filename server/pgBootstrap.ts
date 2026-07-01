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

const BOOT_COLUMNS: Array<[string, string, string]> = [
  ["branches", "verified_by_admin", "BOOLEAN NOT NULL DEFAULT FALSE"],
  ["patients", "data_version", "INTEGER NOT NULL DEFAULT 2"],
  ["patients", "data_migrated_at", "TIMESTAMP"],
  ["patients", "qr_token", "TEXT"],
  ["patients", "qr_token_expires_at", "TIMESTAMP"],
  ["patients", "id_card_pdf_key", "TEXT"],
  ["patients", "id_card_qr_token", "TEXT"],
  ["patients", "id_card_generated_at", "TIMESTAMP"],
];

/** JWT refresh-token store (Part 10). Created via native pg so login works on Vercel/Neon. */
export async function ensureRefreshTokensTable(): Promise<void> {
  const connectionString = process.env.DATABASE_URL || "";
  if (!isPostgresDatabaseUrl(connectionString)) return;

  const pool = new pg.Pool({
    connectionString,
    ssl: poolSsl(connectionString),
  });

  try {
    const exists = await pool.query(
      `SELECT to_regclass('public.refresh_tokens') AS reg`,
    );
    if (exists.rows[0]?.reg) return;

    const staff = await pool.query(`SELECT to_regclass('public.staff') AS reg`);
    if (!staff.rows[0]?.reg) {
      console.warn("[pg-bootstrap] staff table missing; defer refresh_tokens create");
      return;
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        staff_id VARCHAR NOT NULL REFERENCES staff(id),
        session_id VARCHAR NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        expires_at TIMESTAMP NOT NULL,
        revoked_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_refresh_tokens_staff ON refresh_tokens(staff_id)`,
    );
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_refresh_tokens_session ON refresh_tokens(session_id)`,
    );
    console.log("[pg-bootstrap] created refresh_tokens table");
  } catch (error) {
    console.error("[pg-bootstrap] refresh_tokens ensure failed:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

/** Critical columns required by the current Drizzle schema before broad table scans. */
export async function ensurePostgresBootColumns(): Promise<void> {
  for (const [table, column, definition] of BOOT_COLUMNS) {
    try {
      await ensurePostgresColumn(table, column, definition);
    } catch (error) {
      console.warn(`[pg-bootstrap] non-fatal ${table}.${column} ensure failed:`, error);
    }
  }
  try {
    await ensureRefreshTokensTable();
  } catch (error) {
    console.warn("[pg-bootstrap] non-fatal refresh_tokens ensure failed:", error);
  }
}
