/**
 * Run Part 2 additive schema migration manually (idempotent).
 * Usage: npx tsx script/migrate-part2.ts
 */
import "dotenv/config";
import { runPart2SchemaMigration } from "../server/migrations/part2SchemaMigration";

await runPart2SchemaMigration();
console.log("Part 2 migration finished.");
