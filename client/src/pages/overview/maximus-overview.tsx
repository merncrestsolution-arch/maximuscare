import { RoleProtectedRoute } from "@/components/auth/role-protected-route";
import { canAccessMaximusOverview } from "@/lib/permissions";
import { OrganizationOverviewPage } from "./organization-overview-page";

export default function MaximusOverviewPage() {
  return (
    <RoleProtectedRoute allowed={canAccessMaximusOverview}>
      <OrganizationOverviewPage org="maximus-overview" />
    </RoleProtectedRoute>
  );
}
