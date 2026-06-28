import { useState, useEffect, useRef, useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { Building2, Loader2, Sparkles, Receipt } from "lucide-react";
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

type ExpenseCategory = { category: string; amount: number };

// Distinct, accessible palette cycled across expense categories.
const EXPENSE_COLORS = [
  "#ef4444", "#f59e0b", "#8b5cf6", "#0ea5e9", "#10b981",
  "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#84cc16",
];

function ExpenseBreakdownCard({
  data,
  total,
}: {
  data: ExpenseCategory[];
  total: number;
}) {
  const chartData = useMemo(
    () => data.filter((d) => d.amount > 0).map((d, i) => ({ ...d, color: EXPENSE_COLORS[i % EXPENSE_COLORS.length] })),
    [data]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Receipt className="h-5 w-5 text-[#ef4444]" />
          Expense Breakdown by Category
        </CardTitle>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No expenses recorded for this period.
          </p>
        ) : (
          <div className="grid items-center gap-6 lg:grid-cols-[minmax(0,360px)_1fr]">
            <div className="relative">
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={chartData}
                    dataKey="amount"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={110}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {chartData.map((entry) => (
                      <Cell key={entry.category} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, _name, item: any) => {
                      const pct = total > 0 ? ((value / total) * 100).toFixed(1) : "0";
                      return [`${formatCurrency(value)} (${pct}%)`, item?.payload?.category];
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total</span>
                <span className="text-lg font-bold text-foreground">{formatCurrency(total)}</span>
              </div>
            </div>

            <ul className="space-y-2.5">
              {chartData.map((entry) => {
                const pct = total > 0 ? (entry.amount / total) * 100 : 0;
                return (
                  <li key={entry.category} className="flex items-center gap-3">
                    <span
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: entry.color }}
                    />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                      {entry.category}
                    </span>
                    <span className="text-sm font-semibold text-foreground">
                      {formatCurrency(entry.amount)}
                    </span>
                    <span className="w-12 text-right text-xs text-muted-foreground">
                      {pct.toFixed(1)}%
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const ORG_CONFIG = {
  "maximus-overview": {
    title: "Maximus Care Overview",
    description: "Dehiwala, Bandaragama, and Neuro Rehabilitation — aggregated performance only.",
    branchesLabel: "Dehiwala · Bandaragama · Neuro Unit",
    chartTitle: "Branch Comparison (Maximus Care)",
    accent: "border-l-[#1873A8] bg-blue-50/80",
    icon: Building2,
    iconClass: "text-[#1873A8]",
    badgeClass: "bg-blue-100 text-blue-800",
    badge: "Maximus Care",
  },
  "nexus-overview": {
    title: "Nexus Overview",
    description: "Nexus Physio & Rehab Center (Beruwala) — separate from Maximus Care branches.",
    branchesLabel: "Beruwala · Nexus Physio only",
    chartTitle: "Branch Comparison (Nexus)",
    accent: "border-l-[#EE862D] bg-amber-50/80",
    icon: Sparkles,
    iconClass: "text-[#EE862D]",
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
  const expenseBreakdown: ExpenseCategory[] = data?.expenseBreakdown?.byCategory ?? [];
  const expenseTotal: number = data?.expenseBreakdown?.total ?? kpis?.totalExpenses ?? 0;
  const chartData = buildChartData(org, comparison, kpis);
  const incomeColor = isMaximus ? "#1873A8" : "#F45627";
  const patientsColor = isMaximus ? "#105691" : "#EE862D";

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
                  <Bar dataKey="expenses" name="Expenses" fill="#DC2626" />
                  <Bar dataKey="revenue" name="Revenue" fill="#16A34A" />
                  <Bar dataKey="patients" name="Patients" fill={patientsColor} />
                  <Bar dataKey="visits" name="Visits" fill="#1873A8" />
                  <Bar dataKey="sessions" name="Sessions" fill="#6495B6" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <ExpenseBreakdownCard data={expenseBreakdown} total={expenseTotal} />
        </div>
      )}
    </PageShell>
  );
}
