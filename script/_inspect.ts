import { createClient } from "@libsql/client";
import path from "path";

const dbPath = path.join(process.cwd(), "data", "maximus.db");
const client = createClient({ url: `file:${dbPath}` });

async function q(label: string, sql: string) {
  try {
    const r = await client.execute(sql);
    console.log(`\n=== ${label} ===`);
    console.log(JSON.stringify(r.rows, null, 2));
  } catch (e: any) {
    console.log(`\n=== ${label} ERROR: ${e.message} ===`);
  }
}

(async () => {
  await q("branches", "SELECT id, name, branch_name, code, is_active FROM branches");
  await q("staff roles/branches", "SELECT role, branch, count(*) c FROM staff GROUP BY role, branch ORDER BY role");
  await q("staff active count", "SELECT count(*) total, sum(is_active) active FROM staff");
  await q("user_branch_permissions count", "SELECT count(*) c FROM user_branch_permissions");
  await q("user_branch_access count", "SELECT count(*) c FROM user_branch_access");
  await q("visits branch distinct", "SELECT branch, count(*) c, sum(CAST(payment_amount AS REAL)) amt FROM visits GROUP BY branch");
  await q("expenses branch distinct", "SELECT branch, count(*) c, sum(CAST(amount AS REAL)) amt FROM expenses GROUP BY branch");
  await q("inpatient sessions branchId", "SELECT branch_id, count(*) c FROM in_patient_sessions GROUP BY branch_id");
  await q("inpatient admissions cols", "PRAGMA table_info(in_patient_admissions)");
  process.exit(0);
})();
