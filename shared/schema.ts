// Re-exports the active schema. db.ts selects PostgreSQL or SQLite at runtime.
// For static imports (types, schemas), use @shared/schema - it defaults to SQLite.
// Server code should import { db, schema } from "./db" for the runtime schema.
export * from "./schema-sqlite";
