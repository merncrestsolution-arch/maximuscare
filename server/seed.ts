import { db, schema } from "./db";

const { staff: staffTable } = schema;
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

export async function seedDefaultUsers() {
  const defaultUsers = [
    {
      name: "Hajara Inshaf",
      email: "admin@maximuscare.com",
      password: "admin123",
      role: "Admin" as const,
      branch: "Dehiwala" as const,
      phone: "",
      address: "",
    },
    {
      name: "Dr. Inshaf",
      email: "md@maximuscare.com",
      password: "md123",
      role: "MD" as const,
      branch: "Dehiwala" as const,
      phone: "",
      address: "",
    },
    {
      name: "Nexus Managing Director",
      email: "nexusmd@maximuscare.com",
      password: "nexus123",
      role: "Nexus MD" as const,
      branch: "Nexus Physio" as const,
      phone: "",
      address: "",
    },
    {
      name: "Dehiwala Neuro Branch Manager",
      email: "bm.dehiwala@maximuscare.com",
      password: "bm123",
      role: "Branch Manager" as const,
      branch: "Both" as const,
      phone: "",
      address: "",
    },
    {
      name: "Bandaragama Branch Manager",
      email: "bm.bandaragama@maximuscare.com",
      password: "bm123",
      role: "Branch Manager" as const,
      branch: "Bandaragama" as const,
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

    const hashedPassword = await bcrypt.hash(userData.password, 10);

    if (existing.length === 0) {
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
        isActive: true,
      });

      console.log(`[SEED] Created default user: ${userData.email} (${userData.role})`);
    } else {
      const row = existing[0];
      const passwordOk = row.password
        ? await bcrypt.compare(userData.password, row.password)
        : false;
      if (!passwordOk || row.isActive === false || (row.isActive as unknown) === 0) {
        await db
          .update(staffTable)
          .set({ password: hashedPassword, isActive: true } as any)
          .where(eq(staffTable.email, userData.email));
        console.log(`[SEED] Restored default login for: ${userData.email}`);
      } else {
        console.log(`[SEED] User already exists: ${userData.email}`);
      }
    }
  }

  console.log("[SEED] Default users seeding completed");
}
