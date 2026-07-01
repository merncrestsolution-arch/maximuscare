import { useState } from "react";
import { Link } from "wouter";
import { RoleProtectedRoute } from "@/components/auth/role-protected-route";
import { canViewAuditLogs, isAdminRole } from "@/lib/permissions";
import { usePatientDataHealth, useRunPatientDataBackfill, useRegenerateAllPatientIds } from "@/hooks/useData";
import { useAuth } from "@/context/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Database, Loader2, RefreshCw, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function DataHealthContent() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = isAdminRole(user?.role);
  const { data, isLoading, error, refetch } = usePatientDataHealth();
  const backfill = useRunPatientDataBackfill();
  const regenerateIds = useRegenerateAllPatientIds();
  const [lastResult, setLastResult] = useState<{
    processed: number;
    upgraded: number;
    skipped: number;
    errors: string[];
  } | null>(null);
  const [regenResult, setRegenResult] = useState<{
    processed: number;
    regenerated: number;
    admissionsUpdated: number;
    errors: string[];
    samples: Array<{ name: string; oldCode: string; newCode: string }>;
  } | null>(null);
  const [regenOpen, setRegenOpen] = useState(false);
  const [regenConfirm, setRegenConfirm] = useState("");

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

  const runRegenerate = async () => {
    if (regenConfirm !== "REGENERATE-ALL-IDS") {
      toast({
        title: "Confirmation required",
        description: 'Type REGENERATE-ALL-IDS exactly to continue.',
        variant: "destructive",
      });
      return;
    }
    try {
      const result = await regenerateIds.mutateAsync();
      setRegenResult(result);
      setRegenOpen(false);
      setRegenConfirm("");
      await refetch();
      toast({
        title: "Patient IDs regenerated",
        description: `Replaced ${result.regenerated} of ${result.processed} patient IDs`,
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
        title: "Regeneration failed",
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
    {
      label: "Legacy / custom patient IDs",
      value: data?.nonStandardPatientCodes ?? 0,
      warn: (data?.nonStandardPatientCodes ?? 0) > 0,
    },
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
          Patient ID numbers (MC/BRANCH/DDMM/SEQ), QR tokens, and ID card cache status.
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Fill missing IDs only</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Safe to re-run. Assigns a system ID only where one is missing — does not change existing IDs.
          </p>
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
        </CardContent>
      </Card>

      {isAdmin && (
        <Card className="border-amber-200">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-amber-900">
              <AlertTriangle className="h-4 w-4" />
              Regenerate all patient IDs (Admin)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Removes every old, custom, or legacy patient ID and assigns a fresh system ID to{" "}
              <strong>all patients</strong> using the format{" "}
              <code className="text-xs bg-muted px-1 rounded">MC/BRANCH/DDMM/SEQ</code> based on each
              patient&apos;s branch and registration date. Linked in-patient records, QR codes, and ID
              cards are updated. This cannot be undone.
            </p>
            <Button
              variant="destructive"
              onClick={() => setRegenOpen(true)}
              disabled={regenerateIds.isPending}
            >
              {regenerateIds.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <AlertTriangle className="h-4 w-4 mr-2" />
              )}
              Regenerate all patient IDs
            </Button>
          </CardContent>
        </Card>
      )}

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

      {regenResult && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Last ID regeneration</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <p>Processed: {regenResult.processed}</p>
            <p>IDs replaced: {regenResult.regenerated}</p>
            <p>In-patient records updated: {regenResult.admissionsUpdated}</p>
            {regenResult.errors.length > 0 && (
              <p className="text-destructive">Errors: {regenResult.errors.length}</p>
            )}
            {regenResult.samples?.length > 0 && (
              <div className="pt-2 border-t space-y-1">
                <p className="font-medium">Sample changes:</p>
                {regenResult.samples.map((s, i) => (
                  <p key={i} className="text-xs font-mono text-muted-foreground">
                    {s.name}: {s.oldCode} → {s.newCode}
                  </p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <AlertDialog open={regenOpen} onOpenChange={setRegenOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerate all patient IDs?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete every existing patient ID (old, custom, or manual) and issue new
              system-generated IDs for all {data?.totalPatients ?? 0} patients. Type{" "}
              <strong>REGENERATE-ALL-IDS</strong> below to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="regen-confirm">Confirmation</Label>
            <Input
              id="regen-confirm"
              value={regenConfirm}
              onChange={(e) => setRegenConfirm(e.target.value)}
              placeholder="REGENERATE-ALL-IDS"
              autoComplete="off"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRegenConfirm("")}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                void runRegenerate();
              }}
              disabled={regenerateIds.isPending || regenConfirm !== "REGENERATE-ALL-IDS"}
            >
              {regenerateIds.isPending ? "Working…" : "Regenerate all IDs"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
