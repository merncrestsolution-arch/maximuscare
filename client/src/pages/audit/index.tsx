import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { useAuth } from "@/context/auth-context";
import { useAuditLogs, useStaff } from "@/hooks/useData";
import { canViewAuditLogs } from "@/lib/permissions";
import { BRANCH_OPTIONS } from "@/lib/branches";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Activity, Search, Loader2, RefreshCw, ArrowLeft, Download } from "lucide-react";

type AuditLog = {
  id: string;
  userId: string;
  userName: string;
  module?: string | null;
  action: string;
  recordId?: string | null;
  entityType?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
  oldValues?: string | null;
  newValues?: string | null;
  ipAddress?: string | null;
  createdAt: string;
};

const ACTION_CLASS: Record<string, string> = {
  create: "bg-emerald-100 text-emerald-800",
  update: "bg-blue-100 text-blue-800",
  delete: "bg-red-100 text-red-800",
  deactivate: "bg-amber-100 text-amber-800",
  activate: "bg-emerald-100 text-emerald-800",
  login: "bg-indigo-100 text-indigo-800",
  logout: "bg-slate-100 text-slate-700",
  login_failed: "bg-red-100 text-red-800",
};

function actionClass(action: string) {
  return ACTION_CLASS[action?.toLowerCase()] || "bg-slate-100 text-slate-700";
}

function safeParse(value?: string | null): any {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function summarize(log: AuditLog): string {
  const obj = safeParse(log.newValue ?? log.newValues) ?? safeParse(log.oldValue ?? log.oldValues);
  if (!obj || typeof obj !== "object") return log.recordId ? `Record ${log.recordId}` : "";
  const label = obj.name || obj.title || obj.patientName || obj.staffName || obj.email || obj.id;
  return label ? String(label) : log.recordId ? `Record ${log.recordId}` : "";
}

function toCsvValue(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default function AuditLogPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const allowed = canViewAuditLogs(user?.role);
  const { data: logsRaw = [], isLoading, isFetching, refetch } = useAuditLogs({ limit: 500 }, allowed);
  const { data: staffList = [] } = useStaff({ includeInactive: true });
  const logs = (logsRaw as AuditLog[]) || [];

  // Map staff id -> { role, branch } to enrich each event with role + branch.
  const staffMeta = useMemo(() => {
    const m = new Map<string, { role?: string; branch?: string | null }>();
    for (const s of staffList as any[]) m.set(s.id, { role: s.role, branch: s.branch });
    return m;
  }, [staffList]);

  const enriched = useMemo(
    () =>
      logs.map((l) => {
        const meta = staffMeta.get(l.userId);
        return { ...l, _role: meta?.role ?? "", _branch: meta?.branch ?? "" };
      }),
    [logs, staffMeta],
  );

  const modules = useMemo(
    () => Array.from(new Set(logs.map((l) => l.module || l.entityType).filter(Boolean))) as string[],
    [logs],
  );
  const KNOWN_ACTIONS = [
    "create",
    "update",
    "delete",
    "deactivate",
    "activate",
    "login",
    "logout",
    "login_failed",
  ];
  const actions = useMemo(
    () =>
      Array.from(
        new Set([...KNOWN_ACTIONS, ...logs.map((l) => l.action).filter(Boolean)] as string[]),
      ),
    [logs],
  );
  // Include every staff member (not just those who already appear in the log)
  // so admins can filter by any user across all branches.
  const users = useMemo(
    () =>
      Array.from(
        new Set([
          ...(staffList as any[]).map((s) => s.name).filter(Boolean),
          ...logs.map((l) => l.userName).filter(Boolean),
        ] as string[]),
      ).sort((a, b) => a.localeCompare(b)),
    [staffList, logs],
  );
  // List all branches (from the canonical branch list + any branch a staff
  // member belongs to + branches present in the log), not just ones with activity.
  const branches = useMemo(
    () =>
      Array.from(
        new Set([
          ...BRANCH_OPTIONS.map((b) => b.value),
          ...(staffList as any[]).map((s) => s.branch).filter(Boolean),
          ...enriched.map((l) => l._branch).filter(Boolean),
        ] as string[]),
      ),
    [staffList, enriched],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const startTs = startDate ? new Date(`${startDate}T00:00:00`).getTime() : null;
    const endTs = endDate ? new Date(`${endDate}T23:59:59`).getTime() : null;
    return enriched.filter((l) => {
      if (moduleFilter && (l.module || l.entityType) !== moduleFilter) return false;
      if (actionFilter && l.action !== actionFilter) return false;
      if (userFilter && l.userName !== userFilter) return false;
      if (branchFilter && l._branch !== branchFilter) return false;
      if (startTs || endTs) {
        const t = l.createdAt ? new Date(l.createdAt).getTime() : 0;
        if (startTs && t < startTs) return false;
        if (endTs && t > endTs) return false;
      }
      if (q) {
        const hay = [l.userName, l._role, l._branch, l.module, l.entityType, l.action, l.recordId, l.ipAddress, summarize(l)]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [enriched, search, moduleFilter, actionFilter, userFilter, branchFilter, startDate, endDate]);

  if (!allowed) {
    return <div className="p-4 text-muted-foreground">You do not have access to the activity log.</div>;
  }

  const counts = {
    total: filtered.length,
    create: filtered.filter((l) => l.action?.toLowerCase() === "create").length,
    update: filtered.filter((l) => l.action?.toLowerCase() === "update").length,
    delete: filtered.filter((l) => l.action?.toLowerCase() === "delete").length,
  };

  const exportCsv = () => {
    const headers = ["Timestamp", "User", "Role", "Branch", "Module", "Action", "Record", "Detail", "IP Address"];
    const rows = filtered.map((l) => [
      l.createdAt ? format(new Date(l.createdAt), "yyyy-MM-dd HH:mm:ss") : "",
      l.userName || "System",
      l._role || "",
      l._branch || "",
      l.module || l.entityType || "",
      l.action,
      l.recordId || "",
      summarize(l),
      l.ipAddress || "",
    ]);
    const csv = [headers, ...rows].map((r) => r.map(toCsvValue).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `activity-log-${format(new Date(), "yyyyMMdd-HHmm")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const resetFilters = () => {
    setSearch("");
    setModuleFilter("");
    setActionFilter("");
    setUserFilter("");
    setBranchFilter("");
    setStartDate("");
    setEndDate("");
  };

  return (
    <div className="space-y-4 pb-24">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="-ml-2 md:hidden" onClick={() => setLocation("/dashboard")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Activity className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-bold flex-1">Activity Log</h1>
        <Button variant="outline" size="sm" className="gap-2" onClick={exportCsv} data-testid="button-export-audit">
          <Download className="h-4 w-4" /> CSV
        </Button>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        System-wide activity — authentication, staff, patients, appointments, sessions, payments and tasks. Newest first.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          { label: "Events", value: counts.total },
          { label: "Created", value: counts.create },
          { label: "Updated", value: counts.update },
          { label: "Deleted", value: counts.delete },
        ].map((k) => (
          <Card key={k.label} className="bg-white border border-border/60">
            <CardContent className="p-3">
              <div className="text-xs text-muted-foreground">{k.label}</div>
              <div className="text-xl font-bold">{k.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="rounded-xl border border-border/60 bg-white p-3 space-y-2">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search user, record, action, IP…"
              className="pl-9 h-11 bg-background"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={moduleFilter || "all"} onValueChange={(v) => setModuleFilter(v === "all" ? "" : v)}>
            <SelectTrigger className="h-11"><SelectValue placeholder="Module" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All modules</SelectItem>
              {modules.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={actionFilter || "all"} onValueChange={(v) => setActionFilter(v === "all" ? "" : v)}>
            <SelectTrigger className="h-11"><SelectValue placeholder="Action" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              {actions.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
          <Select value={userFilter || "all"} onValueChange={(v) => setUserFilter(v === "all" ? "" : v)}>
            <SelectTrigger className="h-11"><SelectValue placeholder="User" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All users</SelectItem>
              {users.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={branchFilter || "all"} onValueChange={(v) => setBranchFilter(v === "all" ? "" : v)}>
            <SelectTrigger className="h-11"><SelectValue placeholder="Branch" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All branches</SelectItem>
              {branches.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground uppercase">From</Label>
            <Input type="date" className="h-11" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground uppercase">To</Label>
            <Input type="date" className="h-11" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={resetFilters}>Clear filters</Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground bg-muted/10 rounded-lg border border-dashed">
          No activity found.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((log) => {
            const when = log.createdAt ? new Date(log.createdAt) : null;
            const moduleLabel = log.module || log.entityType || "—";
            const detail = summarize(log);
            return (
              <Card key={log.id} className="bg-white border border-border/60">
                <CardContent className="p-3 flex items-start gap-3">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${actionClass(log.action)}`}>
                        {log.action}
                      </span>
                      <Badge variant="outline" className="text-[10px] capitalize">{moduleLabel}</Badge>
                      <span className="font-semibold text-foreground truncate">{log.userName || "System"}</span>
                      {log._role && <span className="text-[11px] text-muted-foreground">· {log._role}</span>}
                      {log._branch && <span className="text-[11px] text-muted-foreground">· {log._branch}</span>}
                    </div>
                    {detail && (
                      <div className="text-sm text-muted-foreground truncate">{detail}</div>
                    )}
                    {log.ipAddress && (
                      <div className="text-[11px] text-muted-foreground/80">IP: {log.ipAddress}</div>
                    )}
                  </div>
                  <div className="text-right text-[11px] text-muted-foreground shrink-0">
                    {when ? (
                      <>
                        <div>{format(when, "dd MMM yyyy")}</div>
                        <div>{format(when, "HH:mm")}</div>
                      </>
                    ) : "—"}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
