/**
 * Reset default admin password to admin123 (or custom via args).
 * Usage: npx tsx script/reset-admin-password.ts [email] [newPassword]
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { db, schema } from "../server/db";
import { eq } from "drizzle-orm";

const email = (process.argv[2] || "admin@maximuscare.com").trim().toLowerCase();
const newPassword = process.argv[3] || "admin123";
const { staff } = schema;

const rows = await db.select().from(staff).where(eq(staff.email, email)).limit(1);
if (!rows[0]) {
  console.error("User not found:", email);
  console.log("Existing accounts:");
  const all = await db.select({ email: staff.email, role: staff.role }).from(staff);
  all.forEach((u) => console.log(`  - ${u.email} (${u.role})`));
  process.exit(1);
}

const hashed = await bcrypt.hash(newPassword, 10);
await db.update(staff).set({ password: hashed, isActive: true } as any).where(eq(staff.email, email));
console.log(`Password reset for ${email} → use: ${newPassword}`);
