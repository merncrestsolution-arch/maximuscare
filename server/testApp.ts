import { ensureSqliteSchemaCompatibility, ensurePostgresSchemaCompatibility } from "./db";
import { storage } from "./storage";
import { seedDefaultUsers } from "./seed";
import { createBaseApp, setupApiRoutes } from "./createApp";

export async function createTestApp() {
  process.env.NODE_ENV = "test";
  if (!process.env.DATABASE_URL?.startsWith("postgresql")) {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || "./data/test-maximus.db";
  }
  await ensureSqliteSchemaCompatibility();
  await ensurePostgresSchemaCompatibility();
  await seedDefaultUsers();
  await storage.seedEnterpriseBranches();

  const { app, httpServer } = createBaseApp();
  await setupApiRoutes(app, httpServer);
  return app;
}
