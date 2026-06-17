import { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

type Props = {
  title: string;
  description?: string;
  filters?: ReactNode;
  actions?: ReactNode;
  loading?: boolean;
  error?: Error | null;
  children: ReactNode;
};

export function ReportPageShell({ title, description, filters, actions, loading, error, children }: Props) {
  return (
    <div className="space-y-6 p-4 md:p-0">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      {filters && (
        <Card>
          <CardContent className="pt-6">{filters}</CardContent>
        </Card>
      )}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : error ? (
        <Alert variant="destructive">
          <AlertDescription>{error.message || "Failed to load report"}</AlertDescription>
        </Alert>
      ) : (
        children
      )}
    </div>
  );
}

export function ReportSummaryCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}
