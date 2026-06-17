import { useState, useEffect, useRef } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { Building2, Loader2, Sparkles } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { reportsApiExtended } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatCard, KpiGrid } from "@/components/ui/stat-card";
import { PageShell } from "@/components/layout/page-shell";
import { OrganizationOverviewToggle } from "@/components/overview/organization-overview-toggle";
import { useBranch } from "@/context/branch-context";
import type { OverviewContext } from "@shared/branchAccess";
import { cn } from "@/lib/utils";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    minimumFractionDigits: 0,
  }).format(amount);
}

type ChartRow = {
  branch: string;
  income: number;
  expenses: number;
  revenue: number;
  patients: number;
  visits: number;
  sessions: number;
};

function buildChartData(
  org: OverviewContext,
  comparison: ChartRow[],
  kpis?: { totalPatients?: number; totalIncome?: number; totalExpenses?: number; totalRevenue?: number }
): ChartRow[] {
  if (comparison.length > 0) return comparison;
  const branch = org === "nexus-overview" ? "Beruwala" : "Maximus Care";
  return [
    {
      branch,
      income: kpis?.totalIncome ?? 0,
      expenses: kpis?.totalExpenses ?? 0,
      revenue: kpis?.totalRevenue ?? 0,
      patients: kpis?.totalPatients ?? 0,
      visits: 0,
      sessions: 0,
    },
  ];
}

function chartTooltipFormatter(value: number, name: string) {
  if (name === "Income" || name === "Expenses" || name === "Revenue") {
    return formatCurrency(value);
  }
  return value.toLocaleString();
}

const ORG_CONFIG = {
  "maximus-overview": {
    title: "Maximus Care Overview",
    description: "Dehiwala, Bandaragama, and Neuro Rehabilitation — aggregated performance only.",
    branchesLabel: "Dehiwala · Bandaragama · Neuro Unit",
    chartTitle: "Branch Comparison (Maximus Care)",
    accent: "border-l-[#2563eb] bg-blue-50/80",
    icon: Building2,
    iconClass: "text-[#2563eb]",
    badgeClass: "bg-blue-100 text-blue-800",
    badge: "Maximus Care",
  },
  "nexus-overview": {
    title: "Nexus Overview",
    description: "Nexus Physio & Rehab Center (Beruwala) — separate from Maximus Care branches.",
    branchesLabel: "Beruwala · Nexus Physio only",
    chartTitle: "Branch Comparison (Nexus)",
    accent: "border-l-[#f59e0b] bg-amber-50/80",
    icon: Sparkles,
    iconClass: "text-[#f59e0b]",
    badgeClass: "bg-amber-100 text-amber-900",
    badge: "Nexus",
  },
} as const;

export function OrganizationOverviewPage({ org }: { org: OverviewContext }) {
  const { selectedContext, selectContext } = useBranch();
  const config = ORG_CONFIG[org];
  const Icon = config.icon;
  const today = new Date();
  const [startDate, setStartDate] = useState(format(startOfMonth(today), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(endOfMonth(today), "yyyy-MM-dd"));
  const syncRef = useRef<string | null>(null);

  useEffect(() => {
    if (selectedContext === org) return;
    if (syncRef.current === org) return;
    syncRef.current = org;
    void selectContext(org).finally(() => {
      if (syncRef.current === org) syncRef.current = null;
    });
  }, [org, selectedContext, selectContext]);

  const isMaximus = org === "maximus-overview";
  const queryKey = isMaximus ? "maximus-overview" : "nexus-overview";
  const enabled = selectedContext === org;

  const { data, isLoading, error } = useQuery({
    queryKey: [queryKey, startDate, endDate],
    queryFn: () =>
      isMaximus
        ? reportsApiExtended.maximusOverview({ startDate, endDate })
        : reportsApiExtended.nexusOverview({ startDate, endDate }),
    enabled,
  });

  const kpis = data?.kpis;
  const comparison = data?.comparison ?? [];
  const chartData = buildChartData(org, comparison, kpis);
  const incomeColor = isMaximus ? "#2563eb" : "#f59e0b";
  const patientsColor = isMaximus ? "#9333ea" : "#d97706";

  return (
    <PageShell
      title={config.title}
      description={config.description}
      actions={
        <div className="flex flex-col gap-3 w-full sm:w-auto">
          <OrganizationOverviewToggle className="w-full sm:w-auto" />
          <div className="flex flex-wrap gap-2">
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-auto bg-background"
            />
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-auto bg-background"
            />
          </div>
        </div>
      }
    >
      <div
        className={cn(
          "rounded-xl border-2 border-border p-4 sm:p-5 border-l-[6px]",
          config.accent
        )}
      >
        <div className="flex flex-wrap items-center gap-3">
          <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl border bg-white shadow-sm", config.iconClass)}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide", config.badgeClass)}>
              {config.badge}
            </span>
            <p className="mt-1 text-sm font-medium text-foreground">{config.branchesLabel}</p>
            <p className="text-xs text-muted-foreground">
              {isMaximus
                ? "Excludes Nexus / Beruwala data"
                : "Excludes Dehiwala, Bandaragama, and Neuro data"}
            </p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : error ? (
        <p className="text-center text-destructive py-8">
          Failed to load {isMaximus ? "Maximus Care" : "Nexus"} overview
        </p>
      ) : (
        <div className="space-y-6">
          <KpiGrid>
            <StatCard title="Total Patients" value={String(kpis?.totalPatients ?? 0)} />
            <StatCard title="Total Income" value={formatCurrency(kpis?.totalIncome ?? 0)} />
            <StatCard title="Total Expenses" value={formatCurrency(kpis?.totalExpenses ?? 0)} />
            <StatCard title="Total Revenue" value={formatCurrency(kpis?.totalRevenue ?? 0)} />
          </KpiGrid>

          <Card>
            <CardHeader>
              <CardTitle>{config.chartTitle}</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={360}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="branch" />
                  <YAxis tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
                  <Tooltip formatter={chartTooltipFormatter} />
                  <Legend />
                  <Bar dataKey="income" name="Income" fill={incomeColor} />
                  <Bar dataKey="expenses" name="Expenses" fill="#ef4444" />
                  <Bar dataKey="revenue" name="Revenue" fill="#16a34a" />
                  <Bar dataKey="patients" name="Patients" fill={patientsColor} />
                  <Bar dataKey="visits" name="Visits" fill="#0ea5e9" />
                  <Bar dataKey="sessions" name="Sessions" fill="#64748b" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}
    </PageShell>
  );
}
