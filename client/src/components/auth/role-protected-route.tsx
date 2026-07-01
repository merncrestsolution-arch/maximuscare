import { Redirect } from "wouter";
import { useAuth } from "@/context/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import type { User } from "@/lib/types";

export function RoleProtectedRoute({
  children,
  allowed,
  fallback = "/dashboard",
}: {
  children: React.ReactNode;
  allowed: (role: string | undefined, user?: User) => boolean;
  fallback?: string;
}) {
  const { user } = useAuth();
  if (!user) return <Redirect to="/auth/login" />;
  if (!allowed(user.role, user)) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            You do not have permission to view this page.
          </CardContent>
        </Card>
      </div>
    );
  }
  return <>{children}</>;
}
