import { RoleProtectedRoute } from "@/components/auth/role-protected-route";
import { canAccessNexusOverview } from "@/lib/permissions";
import { OrganizationOverviewPage } from "./organization-overview-page";

export default function NexusOverviewPage() {
  return (
    <RoleProtectedRoute allowed={canAccessNexusOverview}>
      <OrganizationOverviewPage org="nexus-overview" />
    </RoleProtectedRoute>
  );
}
