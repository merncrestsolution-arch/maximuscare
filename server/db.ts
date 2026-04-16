import "dotenv/config";
import path from "path";
import { mkdirSync, existsSync } from "fs";
import { createRequire } from "module";
import * as schemaSqlite from "@shared/schema-sqlite";
import * as schemaPg from "@shared/schema-pg";

// Resolve native deps from project root (works in CJS bundle and tsx dev; avoids import.meta in dist)
const requireMod = createRequire(path.join(process.cwd(), "package.json"));
const usePostgres = !!process.env.DATABASE_URL?.startsWith("postgresql");

function createDb() {
  if (usePostgres) {
    const { drizzle } = requireMod("drizzle-orm/node-postgres");
    const { Pool } = requireMod("pg");
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    return drizzle(pool, { schema: schemaPg });
  } else {
    const { drizzle } = requireMod("drizzle-orm/libsql");
    const { createClient } = requireMod("@libsql/client");
    const rawPath = process.env.DATABASE_URL || "./data/maximus.db";
    const dbPath = rawPath.startsWith(".")
      ? path.join(process.cwd(), rawPath)
      : rawPath.replace(/^sqlite:/, "");
    const dir = path.dirname(dbPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const client = createClient({ url: `file:${dbPath}` });
    return drizzle(client, { schema: schemaSqlite });
  }
}

const db = createDb();
export { db };

// Export the schema used by the current database (for storage/routes)
export const schema = usePostgres ? schemaPg : schemaSqlite;
