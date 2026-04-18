import { useMemo, useState } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/context/auth-context";
import { usePatients, useVisits, useAttendance, useRevenueSummary, useExpenses, useMyExpenses, useDeleteExpense, useDeleteVisit } from "@/hooks/useData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Users, Calendar, DollarSign, Activity, TrendingUp, Loader2, Plus, Pencil, Trash2, Wallet, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { addDays, format, parseISO, subDays, startOfMonth, addMonths, subMonths, getDaysInMonth } from "date-fns";
import { useInPatientSessionsForStaffRange, useAllInPatientSessionsInRange } from "@/hooks/useData";

import { calculateVisitStats } from "@/lib/stats";
import { isVisitForStaff } from "@/lib/visitAccess";
import { VisitStatsCards } from "@/components/dashboard/visit-stats-cards";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { SiteCreditFooter } from "@/components/site-credit-footer";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR', minimumFractionDigits: 0 }).format(amount);
}

export default function Dashboard() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: patients = [], isLoading: loadingPatients, error: patientsError } = usePatients();
  const { data: visits = [], isLoading: loadingVisits, error: visitsError } = useVisits();
  const { data: attendance = [], isLoading: loadingAttendance } = useAttendance();

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null);
  const [visitDeleteId, setVisitDeleteId] = useState<string | null>(null);
  const [selectedVisitDate, setSelectedVisitDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [ipSessionDate, setIpSessionDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const role = (user?.role || "").toLowerCase();
  const isManagement = role === "admin" || role === "md";
  const isStaff = role === "physiotherapist" || role === "receptionist" || role === "staff";

  const selectedDate = new Date(selectedYear, selectedMonth, 1);
  const monthStart = format(selectedDate, 'yyyy-MM-dd');
  const monthEnd = format(addMonths(selectedDate, 1), 'yyyy-MM-dd');
  const dateParams = { startDate: monthStart, endDate: monthEnd };

  const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const monthOptions: { label: string; month: number; year: number }[] = [];
  for (let i = 0; i < 60; i++) {
    const d = subMonths(now, i);
    monthOptions.push({ label: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`, month: d.getMonth(), year: d.getFullYear() });
  }

  // Revenue and Expense hooks (only for management) - enabled flag prevents API calls for non-management users
  const { data: revenueSummary, isLoading: loadingRevenue } = useRevenueSummary(dateParams, isManagement);
  const { data: expenses = [], isLoading: loadingExpenses } = useExpenses(dateParams, isManagement);
  
  // My expenses hook (for staff to view their own expenses)
  const { data: myExpenses = [], isLoading: loadingMyExpenses } = useMyExpenses(isStaff);
  
  const deleteExpense = useDeleteExpense();
  const deleteVisit = useDeleteVisit();

  const ipDayEnd = useMemo(() => format(addDays(parseISO(ipSessionDate), 1), "yyyy-MM-dd"), [ipSessionDate]);
  const { data: ipSessionsAll = [] } = useAllInPatientSessionsInRange(
    { startDate: ipSessionDate, endDate: ipDayEnd },
    isManagement
  );
  const { data: ipSessionsMine = [] } = useInPatientSessionsForStaffRange(
    { startDate: ipSessionDate, endDate: ipDayEnd, staffId: user?.id || "" },
    !isManagement && !!user?.id
  );
  const ipSessionsForDash = isManagement ? ipSessionsAll : ipSessionsMine;

  const patientNameById = useMemo(
    () => new Map(patients.map((p) => [p.id, p.name])),
    [patients]
  );

  const handleDeleteExpense = async () => {
    if (!deletingExpenseId) return;
    try {
      await deleteExpense.mutateAsync(deletingExpenseId);
      toast({ title: 'Success', description: 'Expense deleted successfully' });
      setDeleteConfirmOpen(false);
      setDeletingExpenseId(null);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleDeleteVisit = async () => {
    if (!visitDeleteId) return;
    try {
      await deleteVisit.mutateAsync(visitDeleteId);
      toast({ title: "Visit deleted", description: "The visit record was removed." });
      setVisitDeleteId(null);
    } catch (error: any) {
      toast({ title: "Error", description: error?.message || "Failed to delete visit", variant: "destructive" });
    }
  };

  if (!user) return null;

  if (loadingPatients || loadingVisits || loadingAttendance) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (patientsError || visitsError) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Failed to load data: {patientsError ? patientsError.message : visitsError?.message || 'Unknown error'}
        </AlertDescription>
      </Alert>
    );
  }
  
  const allMyVisits = visits.filter((v) =>
    isManagement ? true : isVisitForStaff(v, user, { includeCreator: true })
  );
  const myVisits = allMyVisits.filter(v => v.visitDate >= monthStart && v.visitDate < monthEnd);

  const visitStats = calculateVisitStats(myVisits);
  const totalPatients = isManagement ? patients.length : patients.filter(p => myVisits.some(v => v.patientId === p.id)).length;
  const todayVisits = myVisits.filter(v => v.visitDate === format(new Date(), 'yyyy-MM-dd')).length;
  const paidVisits = myVisits.filter(v => v.paymentStatus?.toLowerCase() === 'paid').length;
  const unpaidVisits = myVisits.filter(v => v.paymentStatus?.toLowerCase() !== 'paid').length;
  const unpaidVisitList = myVisits.filter(v => v.paymentStatus?.toLowerCase() !== 'paid').slice(0, 12);
  const selectedDayVisits = allMyVisits.filter((v) => v.visitDate === selectedVisitDate);

  const daysInMonth = getDaysInMonth(selectedDate);
  const chartData = Array.from({ length: daysInMonth }).map((_, i) => {
    const day = i + 1;
    const date = format(new Date(selectedYear, selectedMonth, day), 'yyyy-MM-dd');
    return {
      name: String(day),
      visits: myVisits.filter(v => v.visitDate === date).length,
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1 min-w-0">
          <h1 className="text-2xl font-bold tracking-tight truncate">Dashboard</h1>
          <p className="text-muted-foreground truncate">Welcome back, {user.name}.</p>
        </div>
        <div className="flex flex-col gap-1 w-full sm:w-auto sm:min-w-[180px]">
          <span className="text-xs font-medium text-muted-foreground">Select Month</span>
          <Select
            value={`${selectedMonth}-${selectedYear}`}
            onValueChange={(val) => {
              const [m, y] = val.split('-').map(Number);
              setSelectedMonth(m);
              setSelectedYear(y);
            }}
          >
            <SelectTrigger className="w-full sm:w-[180px]" data-testid="select-month">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map((opt) => (
                <SelectItem key={`${opt.month}-${opt.year}`} value={`${opt.month}-${opt.year}`}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isManagement && (
        <>
          {/* Visit Stats Breakdown */}
          <VisitStatsCards stats={visitStats} />

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-semibold text-muted-foreground">Today's Visits</CardTitle>
                <Calendar className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-extrabold text-foreground">{todayVisits}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-semibold text-muted-foreground">Total Patients</CardTitle>
                <Users className="h-4 w-4 text-accent" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-extrabold text-foreground">{totalPatients}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-semibold text-muted-foreground">Paid Visits</CardTitle>
                <DollarSign className="h-4 w-4 text-emerald-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-extrabold text-emerald-700">{paidVisits}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-semibold text-muted-foreground">Unpaid</CardTitle>
                <DollarSign className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-extrabold text-amber-600">{unpaidVisits}</div>
              </CardContent>
            </Card>
          </div>

          {/* Charts Section */}
          <Card>
            <CardHeader>
              <CardTitle>Visit Trends ({MONTH_NAMES[selectedMonth]} {selectedYear})</CardTitle>
            </CardHeader>
            <CardContent className="pl-0">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData}>
                  <XAxis 
                    dataKey="name" 
                    stroke="#888888" 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false} 
                  />
                  <YAxis 
                    stroke="#888888" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false} 
                    tickFormatter={(value) => `${value}`} 
                  />
                  <Tooltip 
                    cursor={{ fill: 'transparent' }}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Bar dataKey="visits" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </>
      )}

      {/* Staff Expense Entry - Physiotherapist/Receptionist Only */}
      {isStaff && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Add My Expense
            </CardTitle>
            <Button onClick={() => navigate("/expenses/add")} size="sm" data-testid="button-add-my-expense">
              <Plus className="h-4 w-4 mr-1" /> Add Expense
            </Button>
          </CardHeader>
          <CardContent>
            {loadingMyExpenses ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : myExpenses.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-8">
                No expenses recorded. Click "Add Expense" to add your first expense.
              </div>
            ) : (
              <div className="space-y-2">
                <div className="hidden md:grid md:grid-cols-5 gap-2 text-xs font-semibold text-muted-foreground uppercase border-b pb-2">
                  <div>Date</div>
                  <div>Category</div>
                  <div className="col-span-2">Description</div>
                  <div>Amount</div>
                </div>
                {myExpenses.map((expense: any) => (
                  <div key={expense.id} className="grid grid-cols-1 md:grid-cols-5 gap-2 items-center border-b pb-2 last:border-0" data-testid={`row-my-expense-${expense.id}`}>
                    <div className="text-sm">
                      <span className="md:hidden font-medium text-muted-foreground mr-2">Date:</span>
                      {format(new Date(expense.expenseDate), 'dd MMM yyyy')}
                    </div>
                    <div className="text-sm">
                      <span className="md:hidden font-medium text-muted-foreground mr-2">Category:</span>
                      <span className="px-2 py-0.5 bg-slate-100 rounded text-xs">{expense.category}</span>
                    </div>
                    <div className="col-span-2 text-sm">
                      <span className="md:hidden font-medium text-muted-foreground mr-2">Description:</span>
                      {expense.description}
                    </div>
                    <div className="text-sm font-medium">
                      <span className="md:hidden font-medium text-muted-foreground mr-2">Amount:</span>
                      {formatCurrency(parseFloat(expense.amount))}
                      <span className="text-xs text-muted-foreground ml-1">({expense.paymentMode})</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Unpaid Visits (Quick View)</CardTitle>
        </CardHeader>
        <CardContent>
          {unpaidVisitList.length === 0 ? (
            <div className="text-sm text-muted-foreground">No unpaid visits in selected month.</div>
          ) : (
            <div className="space-y-2">
              {unpaidVisitList.map((visit: any) => (
                <div key={visit.id} className="flex items-center justify-between gap-2 border rounded-lg p-3" data-testid={`row-unpaid-${visit.id}`}>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{patientNameById.get(visit.patientId) || "Unknown patient"}</div>
                    <div className="text-xs text-muted-foreground truncate">{visit.condition}</div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="outline" size="sm" onClick={() => navigate(`/visits/edit/${visit.id}`)} data-testid={`button-edit-unpaid-${visit.id}`}>
                      Edit
                    </Button>
                    {isManagement && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setVisitDeleteId(visit.id)}
                        data-testid={`button-delete-unpaid-${visit.id}`}
                        aria-label="Delete visit"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle>Today's Visits (Select Date)</CardTitle>
          <input
            type="date"
            value={selectedVisitDate}
            onChange={(e) => setSelectedVisitDate(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            data-testid="input-selected-visit-date"
          />
        </CardHeader>
        <CardContent>
          {selectedDayVisits.length === 0 ? (
            <div className="text-sm text-muted-foreground">No visits on this date.</div>
          ) : (
            <div className="space-y-2">
              {selectedDayVisits.map((visit: any) => (
                <div key={visit.id} className="grid grid-cols-1 md:grid-cols-4 gap-2 border rounded-lg p-3" data-testid={`row-selected-date-visit-${visit.id}`}>
                  <div className="text-sm"><span className="font-medium">Pt:</span> {patientNameById.get(visit.patientId) || "Unknown"}</div>
                  <div className="text-sm"><span className="font-medium">Condition:</span> {visit.condition}</div>
                  <div className="text-sm"><span className="font-medium">Physio:</span> {visit.treatingStaffName || "-"}</div>
                  <div className="flex justify-start md:justify-end gap-1">
                    <Button variant="outline" size="sm" onClick={() => navigate(`/visits/edit/${visit.id}`)} data-testid={`button-edit-date-visit-${visit.id}`}>
                      Edit
                    </Button>
                    {isManagement && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setVisitDeleteId(visit.id)}
                        data-testid={`button-delete-date-visit-${visit.id}`}
                        aria-label="Delete visit"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle>In-patient sessions</CardTitle>
          <input
            type="date"
            value={ipSessionDate}
            onChange={(e) => setIpSessionDate(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            data-testid="input-ip-session-date"
          />
        </CardHeader>
        <CardContent>
          {ipSessionsForDash.length === 0 ? (
            <div className="text-sm text-muted-foreground">No in-patient sessions on this date.</div>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 text-left text-xs font-semibold text-muted-foreground">
                    <th className="p-2">Patient</th>
                    <th className="p-2">Physio</th>
                    <th className="p-2">Session</th>
                    <th className="p-2 whitespace-nowrap">Date</th>
                    <th className="p-2 w-24">Edit</th>
                  </tr>
                </thead>
                <tbody>
                  {ipSessionsForDash.map((s: any) => (
                    <tr key={s.id} className="border-t border-border/60">
                      <td className="p-2 align-top">{s.patientName}</td>
                      <td className="p-2 align-top">{s.treatingStaffName}</td>
                      <td className="p-2 align-top max-w-[220px]">
                        <span className="text-xs text-muted-foreground">#{s.sessionNumber}</span>{" "}
                        <span className="line-clamp-2">{s.treatmentProvided}</span>
                      </td>
                      <td className="p-2 align-top whitespace-nowrap text-muted-foreground">
                        {s.sessionDate ? format(parseISO(s.sessionDate), "dd MMM yyyy") : "—"}
                      </td>
                      <td className="p-2 align-top">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/inpatients/${s.admissionId}`} data-testid={`link-ip-session-${s.id}`}>
                            Edit
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Revenue Summary - MD/Admin Only */}
      {isManagement && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Revenue Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingRevenue ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-emerald-50 border-emerald-200">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 text-sm text-emerald-600 mb-1">
                      <ArrowDownLeft className="h-4 w-4" />
                      Total Incoming
                    </div>
                    <div className="text-2xl font-bold text-emerald-700" data-testid="text-total-income">
                      {formatCurrency(revenueSummary?.totalIncome || 0)}
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-red-50 border-red-200">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 text-sm text-red-600 mb-1">
                      <ArrowUpRight className="h-4 w-4" />
                      Total Expenses
                    </div>
                    <div className="text-2xl font-bold text-red-700" data-testid="text-total-expenses">
                      {formatCurrency(revenueSummary?.totalExpenses || 0)}
                    </div>
                  </CardContent>
                </Card>
                <Card className={`${(revenueSummary?.netRevenue || 0) >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-amber-50 border-amber-200'}`}>
                  <CardContent className="pt-4">
                    <div className={`flex items-center gap-2 text-sm mb-1 ${(revenueSummary?.netRevenue || 0) >= 0 ? 'text-blue-600' : 'text-amber-600'}`}>
                      <TrendingUp className="h-4 w-4" />
                      Net Revenue
                    </div>
                    <div className={`text-2xl font-bold ${(revenueSummary?.netRevenue || 0) >= 0 ? 'text-blue-700' : 'text-amber-700'}`} data-testid="text-net-revenue">
                      {formatCurrency(revenueSummary?.netRevenue || 0)}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Expenses Section - MD/Admin Only */}
      {isManagement && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Expenses</CardTitle>
            <Button onClick={() => navigate("/expenses/add")} size="sm" data-testid="button-add-expense">
              <Plus className="h-4 w-4 mr-1" /> Add Expense
            </Button>
          </CardHeader>
          <CardContent>
            {loadingExpenses ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : expenses.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-8">
                No expenses recorded for this period.
              </div>
            ) : (
              <div className="space-y-2">
                <div className="hidden md:grid md:grid-cols-6 gap-2 text-xs font-semibold text-muted-foreground uppercase border-b pb-2">
                  <div>Date</div>
                  <div>Category</div>
                  <div className="col-span-2">Description</div>
                  <div>Amount</div>
                  <div className="text-right">Actions</div>
                </div>
                {expenses.map((expense: any) => (
                  <div key={expense.id} className="grid grid-cols-1 md:grid-cols-6 gap-2 items-center border-b pb-2 last:border-0" data-testid={`row-expense-${expense.id}`}>
                    <div className="text-sm">
                      <span className="md:hidden font-medium text-muted-foreground mr-2">Date:</span>
                      {format(new Date(expense.expenseDate), 'dd MMM yyyy')}
                    </div>
                    <div className="text-sm">
                      <span className="md:hidden font-medium text-muted-foreground mr-2">Category:</span>
                      <span className="px-2 py-0.5 bg-slate-100 rounded text-xs">{expense.category}</span>
                    </div>
                    <div className="col-span-2 text-sm">
                      <span className="md:hidden font-medium text-muted-foreground mr-2">Description:</span>
                      {expense.description}
                    </div>
                    <div className="text-sm font-medium">
                      <span className="md:hidden font-medium text-muted-foreground mr-2">Amount:</span>
                      {formatCurrency(parseFloat(expense.amount))}
                      <span className="text-xs text-muted-foreground ml-1">({expense.paymentMode})</span>
                    </div>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => navigate(`/expenses/edit/${expense.id}`)} data-testid={`button-edit-expense-${expense.id}`}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => { setDeletingExpenseId(expense.id); setDeleteConfirmOpen(true); }} data-testid={`button-delete-expense-${expense.id}`}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Admin Only: Attendance Summary */}
      {isManagement && (
        <Card>
          <CardHeader>
            <CardTitle>Today's Attendance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
               {attendance
                 .filter(a => a.date === format(new Date(), 'yyyy-MM-dd'))
                 .map(record => (
                   <div key={record.id} className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0">
                     <div>
                       <div className="font-medium">{record.staffName}</div>
                       <div className="text-xs text-muted-foreground">{record.role}</div>
                     </div>
                     <div className={`px-2 py-1 rounded text-xs font-medium ${record.status === 'Present' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                       {record.status}
                     </div>
                   </div>
                 ))}
               {attendance.filter(a => a.date === format(new Date(), 'yyyy-MM-dd')).length === 0 && (
                 <div className="text-center text-sm text-muted-foreground py-4">No attendance marked today yet.</div>
               )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Modal */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Expense</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-foreground">Are you sure you want to delete this expense?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteExpense} disabled={deleteExpense.isPending} data-testid="button-confirm-delete-expense">
              {deleteExpense.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!visitDeleteId} onOpenChange={(open) => !open && setVisitDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete visit</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-foreground">This permanently removes the visit record. Continue?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVisitDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteVisit} disabled={deleteVisit.isPending} data-testid="button-confirm-delete-visit">
              {deleteVisit.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SiteCreditFooter />
    </div>
  );
}
