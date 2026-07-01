import { isPostgresDatabaseUrl } from "../pgBootstrap";

/** Shared Postgres detection for SQL migrations (accepts postgres:// and postgresql://). */
export function migrationUsePostgres(): boolean {
  return isPostgresDatabaseUrl();
}
