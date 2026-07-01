import { useState } from "react";
import { Link } from "wouter";
import { RoleProtectedRoute } from "@/components/auth/role-protected-route";
import { canViewAuditLogs } from "@/lib/permissions";
import { usePatientDataHealth, useRunPatientDataBackfill } from "@/hooks/useData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Database, Loader2, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function DataHealthContent() {
  const { toast } = useToast();
  const { data, isLoading, error, refetch } = usePatientDataHealth();
  const backfill = useRunPatientDataBackfill();
  const [lastResult, setLastResult] = useState<{
    processed: number;
    upgraded: number;
    skipped: number;
    errors: string[];
  } | null>(null);

  const runBackfill = async () => {
    try {
      const result = await backfill.mutateAsync({ batchSize: 100 });
      setLastResult(result);
      await refetch();
      toast({
        title: "Backfill complete",
        description: `Upgraded ${result.upgraded} of ${result.processed} patients`,
      });
      if (result.errors?.length) {
        toast({
          title: `${result.errors.length} errors`,
          description: result.errors.slice(0, 2).join("; "),
          variant: "destructive",
        });
      }
    } catch (e) {
      toast({
        title: "Backfill failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-destructive">
        {(error as Error).message}
      </div>
    );
  }

  const rows = [
    { label: "Total patients", value: data?.totalPatients ?? 0 },
    { label: "Current data version", value: data?.currentDataVersion ?? "—" },
    { label: "Outdated data version", value: data?.outdatedDataVersion ?? 0, warn: (data?.outdatedDataVersion ?? 0) > 0 },
    { label: "Missing patient ID", value: data?.missingPatientCode ?? 0, warn: (data?.missingPatientCode ?? 0) > 0 },
    { label: "Missing QR token", value: data?.missingQrToken ?? 0, warn: (data?.missingQrToken ?? 0) > 0 },
    { label: "No cached ID card PDF", value: data?.missingIdCardCache ?? 0 },
  ];

  return (
    <div className="space-y-6 p-4 max-w-2xl mx-auto">
      <div className="flex items-center gap-2">
        <Link href="/settings">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Settings
          </Button>
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Database className="h-6 w-6 text-primary" />
          Patient Data Health
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          ID numbers, QR tokens, and ID card cache status. Backfill is safe to re-run.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {rows.map((row) => (
            <div key={row.label} className="flex justify-between text-sm">
              <span className="text-muted-foreground">{row.label}</span>
              <span className={row.warn ? "font-semibold text-amber-600" : "font-medium"}>
                {row.value}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button onClick={runBackfill} disabled={backfill.isPending}>
          {backfill.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Run batch upgrade
        </Button>
        <Button variant="outline" onClick={() => refetch()}>
          Refresh
        </Button>
      </div>

      {lastResult && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Last backfill</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <p>Processed: {lastResult.processed}</p>
            <p>Upgraded: {lastResult.upgraded}</p>
            <p>Skipped (already current): {lastResult.skipped}</p>
            {lastResult.errors.length > 0 && (
              <p className="text-destructive">Errors: {lastResult.errors.length}</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function DataHealthPage() {
  return (
    <RoleProtectedRoute allowed={canViewAuditLogs}>
      <DataHealthContent />
    </RoleProtectedRoute>
  );
}
