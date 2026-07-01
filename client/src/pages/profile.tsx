import { useAuth } from "@/context/auth-context";
import { useVisits, useAttendance, usePatients } from "@/hooks/useData";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LogOut, CalendarCheck, Stethoscope, Pencil, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { Link } from "wouter";
import { isVisitForStaff } from "@/lib/visitAccess";
import { AppAboutCard } from "@/components/app-about-card";

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const { data: visits = [], isLoading: loadingVisits } = useVisits();
  const { data: patients = [] } = usePatients();
  const { data: myAttendance = [], isLoading: loadingAttendance } = useAttendance({
    staffId: user?.id,
  });

  if (!user) return null;

  const myVisits = visits
    .filter((v) => isVisitForStaff(v, user, { includeCreator: true }))
    .sort((a, b) => new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime());

  const patientName = (patientId: string) =>
    patients.find((p) => p.id === patientId)?.name ?? "Patient";

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border/60 bg-white shadow-sm p-5" data-testid="card-profile-header">
        <div className="text-sm text-muted-foreground" data-testid="text-profile-header-label">Profile</div>
        <div className="mt-1 text-2xl font-bold text-foreground" data-testid="text-profile-name">{user.name}</div>
        <div className="mt-2 flex flex-wrap gap-2">
          <div className="px-3 py-1 rounded-full bg-black text-white text-xs font-semibold" data-testid="badge-profile-role">
            {user.role}
          </div>
          <div className="px-3 py-1 rounded-full bg-muted/20 text-foreground text-xs font-semibold" data-testid="badge-profile-branch">
            {user.branch || "Head Office"}
          </div>
        </div>
      </div>

      {/* Staff Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Staff Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Name</span>
            <span className="font-medium" data-testid="text-staff-name">{user.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Role</span>
            <span className="font-medium" data-testid="text-staff-role">{user.role}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Address</span>
            <span className="font-medium text-right max-w-[55%]" data-testid="text-staff-address">{user.address || "-"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">NIC No</span>
            <span className="font-medium" data-testid="text-staff-nic">{user.nic || "-"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Passport No</span>
            <span className="font-medium" data-testid="text-staff-passport">{user.passportNo || "-"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Phone</span>
            <span className="font-medium" data-testid="text-staff-phone">{user.phone || "-"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Degree</span>
            <span className="font-medium text-right max-w-[55%]" data-testid="text-staff-degree">{user.degree || "-"}</span>
          </div>
        </CardContent>
      </Card>

      {/* My Attendance Records */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarCheck className="h-4 w-4 text-primary" />
            My Attendance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 max-h-64 overflow-y-auto no-scrollbar">
          {loadingAttendance ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {myAttendance.length === 0 && (
                <p className="text-sm text-muted-foreground">No attendance records yet.</p>
              )}
              {myAttendance.map((record) => (
                <div key={record.id} className="flex items-center justify-between border-b last:border-0 pb-2 last:pb-0">
                  <div>
                    <div className="text-sm font-medium" data-testid={`text-attendance-date-${record.id}`}>
                      {format(new Date(record.date), "EEE, dd MMM yyyy")}
                    </div>
                    {record.checkInTime && (
                      <div className="text-xs text-muted-foreground">
                        In: {format(new Date(record.checkInTime), "hh:mm a")}
                        {record.checkOutTime && ` · Out: ${format(new Date(record.checkOutTime), "hh:mm a")}`}
                      </div>
                    )}
                  </div>
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-semibold ${record.status === "Present" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}
                    data-testid={`badge-attendance-status-${record.id}`}
                  >
                    {record.status}
                  </span>
                </div>
              ))}
            </>
          )}
        </CardContent>
      </Card>

      {/* My Patient Visits */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Stethoscope className="h-4 w-4 text-primary" />
            My Patient Visits
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 max-h-72 overflow-y-auto no-scrollbar">
          {loadingVisits ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {myVisits.length === 0 && (
                <p className="text-sm text-muted-foreground">No visits recorded yet.</p>
              )}
              {myVisits.map((visit) => (
                <div
                  key={visit.id}
                  className="border rounded-lg p-3 space-y-2"
                  data-testid={`card-visit-${visit.id}`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex justify-between text-sm font-semibold gap-2">
                        <span className="truncate">Session #{visit.sessionNumber}</span>
                        <span className="shrink-0">{format(new Date(visit.visitDate), "dd MMM yyyy")}</span>
                      </div>
                      <div className="text-xs font-medium text-foreground truncate">{patientName(visit.patientId)}</div>
                      <div className="text-sm text-muted-foreground line-clamp-2">{visit.condition}</div>
                      <div className="flex flex-wrap justify-between items-center gap-2 text-xs pt-0.5">
                        <span className="uppercase tracking-wide text-muted-foreground">
                          {visit.branch} · {visit.visitType}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full font-medium shrink-0 ${visit.paymentStatus === "Paid" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}
                        >
                          {visit.paymentStatus}
                        </span>
                      </div>
                    </div>
                    <Link href={`/visits/edit/${visit.id}`}>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 shrink-0"
                        data-testid={`button-edit-visit-${visit.id}`}
                        aria-label="Edit visit"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </>
          )}
        </CardContent>
      </Card>

      <AppAboutCard />

      <div className="pt-4 pb-8">
        <Button
          variant="destructive"
          className="w-full h-12 text-base gap-2"
          onClick={logout}
          data-testid="button-logout"
        >
          <LogOut className="h-5 w-5" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}
