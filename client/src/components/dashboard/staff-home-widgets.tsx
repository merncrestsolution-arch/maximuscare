import { Link } from "wouter";
import { format } from "date-fns";
import { useAuth } from "@/context/auth-context";
import {
  useStaffStats,
  useTaskDashboard,
  useAttendance,
  useVisits,
  useUnreadNotificationCount,
} from "@/hooks/useData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarCheck, ListTodo, Bell, Stethoscope, Activity, TrendingUp } from "lucide-react";
import { startOfMonth, endOfMonth } from "date-fns";
import { clinicTodayString } from "@/lib/utils";

export function StaffHomeWidgets() {
  const { user } = useAuth();
  // Bug B: use the clinic's Sri Lanka "today" so it matches the date attendance/visits
  // are stored with (avoids the widget showing nothing when the browser TZ differs).
  const today = clinicTodayString();
  const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(new Date()), "yyyy-MM-dd");

  const { data: stats } = useStaffStats(user?.id || "", { startDate: monthStart, endDate: monthEnd }, !!user?.id);
  const { data: taskDash } = useTaskDashboard(false);
  const { data: attendance = [] } = useAttendance({ staffId: user?.id });
  const { data: visits = [] } = useVisits({ startDate: today, endDate: today });
  const { data: unread } = useUnreadNotificationCount();

  const todayAtt = attendance.find((a: any) => a.date === today);
  const myVisitsToday = visits.filter(
    (v: any) => v.treatingStaffId === user?.id || v.createdByStaffId === user?.id,
  );

  if (!user) return null;

  return (
    <div className="space-y-4">
      <Card className="bg-gradient-to-br from-[#105691] via-[#1873A8] to-[#1B7EB7] text-white border-0">
        <CardContent className="p-5 flex items-center gap-4">
          {(user as any).photoUri ? (
            <img src={(user as any).photoUri} alt="" className="h-14 w-14 rounded-full object-cover border-2 border-white/20" />
          ) : (
            <div className="h-14 w-14 rounded-full bg-white/10 flex items-center justify-center text-xl font-bold">
              {user.name?.charAt(0)}
            </div>
          )}
          <div>
            <div className="text-sm text-white/70">Welcome back</div>
            <div className="text-xl font-bold">{user.name}</div>
            <div className="text-sm text-white/60">{format(new Date(), "EEEE, dd MMMM yyyy")}</div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Today&apos;s Attendance</div>
            <div className="text-lg font-bold mt-1">{todayAtt?.status ?? "Not marked"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Today&apos;s Visits</div>
            <div className="text-lg font-bold mt-1">{myVisitsToday.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Pending Tasks</div>
            <div className="text-lg font-bold mt-1">{taskDash?.pending ?? 0}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <ListTodo className="h-4 w-4" /> Tasks
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-3 text-sm">
          <div><span className="text-muted-foreground">Due today</span><div className="font-bold">{taskDash?.dueToday ?? 0}</div></div>
          <div><span className="text-muted-foreground">Overdue</span><div className="font-bold text-destructive">{taskDash?.overdue ?? 0}</div></div>
          <div><span className="text-muted-foreground">Completed</span><div className="font-bold">{taskDash?.completed ?? 0}</div></div>
        </CardContent>
      </Card>

      {stats && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> This Month
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div><span className="text-muted-foreground">Visits</span><div className="font-bold">{stats.totalVisits}</div></div>
            <div><span className="text-muted-foreground">Sessions</span><div className="font-bold">{stats.totalSessions}</div></div>
            <div><span className="text-muted-foreground">Incentives</span><div className="font-bold">{stats.totalIncentiveCount}</div></div>
            <div><span className="text-muted-foreground">Attendance</span><div className="font-bold">{stats.attendance.attendancePercent}%</div></div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        <Button variant="outline" className="h-11" asChild>
          <Link href="/attendance"><CalendarCheck className="h-4 w-4 mr-2" />Attendance</Link>
        </Button>
        <Button variant="outline" className="h-11" asChild>
          <Link href="/visits/new"><Stethoscope className="h-4 w-4 mr-2" />Add Visit</Link>
        </Button>
        <Button variant="outline" className="h-11" asChild>
          <Link href="/tasks"><Activity className="h-4 w-4 mr-2" />Tasks</Link>
        </Button>
        <Button variant="outline" className="h-11" asChild>
          <Link href="/notifications">
            <Bell className="h-4 w-4 mr-2" />
            Notifications{unread?.count ? ` (${unread.count})` : ""}
          </Link>
        </Button>
      </div>
    </div>
  );
}
