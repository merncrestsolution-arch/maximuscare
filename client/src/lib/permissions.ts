/** Admin and Medical Director — full record management (edit/delete across modules). */
export function isManagementRole(role: string | undefined): boolean {
  return role === "Admin" || role === "MD";
}
