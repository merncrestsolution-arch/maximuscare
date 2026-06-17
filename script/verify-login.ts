import "dotenv/config";
import bcrypt from "bcryptjs";
import { db, schema } from "../server/db";
import { eq } from "drizzle-orm";

const email = process.argv[2] || "admin@maximuscare.com";
const password = process.argv[3] || "admin123";

const { staff } = schema;
const rows = await db.select().from(staff).where(eq(staff.email, email)).limit(1);
const user = rows[0];
if (!user) {
  console.error("No user found for:", email);
  process.exit(1);
}
const ok = user.password ? await bcrypt.compare(password, user.password) : false;
console.log({ email: user.email, role: user.role, isActive: user.isActive, passwordMatch: ok });
