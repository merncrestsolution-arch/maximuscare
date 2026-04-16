import { db, schema } from "./db";

const { staff: staffTable } = schema;
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

export async function seedDefaultUsers() {
  const defaultUsers = [
    {
      name: "Admin User",
      email: "admin@maximuscare.com",
      password: "admin123",
      role: "Admin" as const,
      branch: "Colombo" as const,
      phone: "",
      address: "",
    },
    {
      name: "Managing Director",
      email: "md@maximuscare.com",
      password: "md123",
      role: "MD" as const,
      branch: "Colombo" as const,
      phone: "",
      address: "",
    },
  ];

  for (const userData of defaultUsers) {
    const existing = await db
      .select()
      .from(staffTable)
      .where(eq(staffTable.email, userData.email))
      .limit(1);

    if (existing.length === 0) {
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      const id = crypto.randomUUID();

      await db.insert(staffTable).values({
        id,
        name: userData.name,
        email: userData.email,
        password: hashedPassword,
        role: userData.role,
        branch: userData.branch,
        phone: userData.phone,
        address: userData.address,
      });

      console.log(`[SEED] Created default user: ${userData.email} (${userData.role})`);
    } else {
      console.log(`[SEED] User already exists: ${userData.email}`);
    }
  }

  console.log("[SEED] Default users seeding completed");
}
