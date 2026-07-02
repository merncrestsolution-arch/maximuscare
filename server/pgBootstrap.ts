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

function isQuotaExceededError(error: unknown): boolean {
  const message = String((error as Error)?.message ?? error ?? "");
  return /exceeded the data transfer quota/i.test(message);
}

function createBootstrapPool(connectionString: string) {
  return new pg.Pool({
    connectionString,
    ssl: poolSsl(connectionString),
    max: 1,
  });
}

const BOOT_COLUMNS: Array<[string, string, string]> = [
  ["patients", "data_version", "INTEGER NOT NULL DEFAULT 2"],
  ["patients", "data_migrated_at", "TIMESTAMP"],
  ["patients", "qr_token", "TEXT"],
  ["patients", "qr_token_expires_at", "TIMESTAMP"],
  ["patients", "id_card_pdf_key", "TEXT"],
  ["patients", "id_card_qr_token", "TEXT"],
  ["patients", "id_card_generated_at", "TIMESTAMP"],
];

/** Add a Postgres column using the native driver (reliable in Vercel serverless bundles). */
export async function ensurePostgresColumn(
  table: string,
  column: string,
  definition: string,
  pool?: pg.Pool,
): Promise<void> {
  const connectionString = process.env.DATABASE_URL || "";
  if (!isPostgresDatabaseUrl(connectionString)) return;

  const ownsPool = !pool;
  const clientPool = pool ?? createBootstrapPool(connectionString);

  try {
    const { rows } = await clientPool.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
      [table, column],
    );
    if (rows.length > 0) return;

    await clientPool.query(`ALTER TABLE "${table}" ADD COLUMN "${column}" ${definition}`);
    console.log(`[pg-bootstrap] added ${table}.${column}`);
  } finally {
    if (ownsPool) await clientPool.end();
  }
}

/** JWT refresh-token store (Part 10). Created via native pg so login works on Vercel/Neon. */
export async function ensureRefreshTokensTable(pool: pg.Pool): Promise<void> {
  const exists = await pool.query(`SELECT to_regclass('public.refresh_tokens') AS reg`);
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
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_staff ON refresh_tokens(staff_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_session ON refresh_tokens(session_id)`);
  console.log("[pg-bootstrap] created refresh_tokens table");
}

async function ensureBootColumnsWithPool(pool: pg.Pool): Promise<void> {
  const byTable = new Map<string, Array<[string, string]>>();
  for (const [table, column, definition] of BOOT_COLUMNS) {
    const entries = byTable.get(table) ?? [];
    entries.push([column, definition]);
    byTable.set(table, entries);
  }

  for (const [table, columns] of byTable) {
    const names = columns.map(([column]) => column);
    const { rows } = await pool.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1 AND column_name = ANY($2::text[])`,
      [table, names],
    );
    const existing = new Set(rows.map((row) => String(row.column_name)));
    for (const [column, definition] of columns) {
      if (existing.has(column)) continue;
      await pool.query(`ALTER TABLE "${table}" ADD COLUMN "${column}" ${definition}`);
      console.log(`[pg-bootstrap] added ${table}.${column}`);
    }
  }
}

/** Critical columns required by the current Drizzle schema before broad table scans. */
export async function ensurePostgresBootColumns(): Promise<void> {
  const connectionString = process.env.DATABASE_URL || "";
  if (!isPostgresDatabaseUrl(connectionString)) return;

  const pool = createBootstrapPool(connectionString);
  try {
    await ensureBootColumnsWithPool(pool);
    await ensureRefreshTokensTable(pool);
  } catch (error) {
    if (isQuotaExceededError(error)) {
      const quotaError = new Error(
        "Database quota exceeded (Neon data transfer limit). Upgrade your Neon plan or wait for the monthly reset, then retry.",
      );
      (quotaError as Error & { cause?: unknown }).cause = error;
      throw quotaError;
    }
    console.error("[pg-bootstrap] refresh_tokens ensure failed:", error);
    throw error;
  } finally {
    await pool.end();
  }
}
