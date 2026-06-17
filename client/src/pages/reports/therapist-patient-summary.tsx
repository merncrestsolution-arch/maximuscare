import { Link } from "wouter";
import { useTherapistPatientReport } from "@/hooks/useData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { RoleProtectedRoute } from "@/components/auth/role-protected-route";
import { canViewManagementReports } from "@/lib/permissions";

function TherapistPatientSummaryContent() {
  const { data: grouped = [], isLoading, error } = useTherapistPatientReport();

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return <p className="text-destructive text-center py-8">Failed to load therapist summary</p>;
  }

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-2xl font-bold">Therapist Patient Summary</h1>
      <p className="text-sm text-muted-foreground">
        Patients grouped by the therapist who handled their first visit (permanent assignment).
      </p>
      {grouped.map((g: any) => (
        <Card key={g.therapistId}>
          <CardHeader>
            <CardTitle>{g.therapistName}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {g.patients.map((p: any) => (
              <div key={p.id} className="flex justify-between">
                <Link href={`/patients/${p.id}`} className="text-primary hover:underline">
                  {p.name}
                </Link>
                <span className="text-sm text-muted-foreground">{p.visitCount} visits</span>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function TherapistPatientSummaryPage() {
  return (
    <RoleProtectedRoute allowed={canViewManagementReports}>
      <TherapistPatientSummaryContent />
    </RoleProtectedRoute>
  );
}
