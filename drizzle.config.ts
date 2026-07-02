import "dotenv/config";
import path from "path";
import { defineConfig } from "drizzle-kit";
import { migrationDatabaseUrl } from "./script/postgresUrl";

const dbUrl = migrationDatabaseUrl();
const usePostgres = /^postgres(ql)?:\/\//i.test(dbUrl);

export default defineConfig({
  schema: usePostgres ? "./shared/schema-pg.ts" : "./shared/schema-sqlite.ts",
  out: "./drizzle/migrations",
  dialect: usePostgres ? "postgresql" : "sqlite",
  dbCredentials: usePostgres
    ? { url: dbUrl }
    : {
        url: (() => {
          const rawPath = process.env.DATABASE_URL || "./data/maximus.db";
          const dbPath = rawPath.startsWith(".")
            ? path.join(process.cwd(), rawPath)
            : rawPath.replace(/^sqlite:/, "");
          return dbPath.startsWith("file:") ? dbPath : `file:${dbPath}`;
        })(),
      },
});
