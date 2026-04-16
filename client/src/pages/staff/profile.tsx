import { useRoute } from "wouter";
import { useAuth } from "@/context/auth-context";
import { useVisits, useAttendance, useStaffMember, usePatients } from "@/hooks/useData";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Edit2, CalendarCheck, Stethoscope, Pencil } from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { calculateVisitStats } from "@/lib/stats";
import { VisitStatsCards } from "@/components/dashboard/visit-stats-cards";
import { isVisitForStaff } from "@/lib/visitAccess";

export default function StaffProfilePage() {
  const [match, params] = useRoute("/staff/:id");
  const { user: currentUser } = useAuth();
  const staffId = params?.id || "";
  const { data: profileUser, isLoading: staffLoading, error: staffError } = useStaffMember(staffId);
  const { data: allVisits = [] } = useVisits();
  const { data: patients = [] } = usePatients();
  const { data: staffAttendance = [] } = useAttendance({ staffId });

  if (!match || !params || !currentUser) return null;

  const role = (currentUser.role || "").toLowerCase();
  const isManagement = role === "admin" || role === "md";
  if (!isManagement && currentUser.id !== params.id) {
    return <div>Unauthorized</div>;
  }

  if (staffLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="text-muted-foreground">Loading…</span>
      </div>
    );
  }

  if (staffError || !profileUser) {
    return <div className="p-4 text-muted-foreground">Staff member not found.</div>;
  }

  const staffVisits = allVisits
    .filter((v) => isVisitForStaff(v, profileUser))
    .sort((a, b) => new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime());
  const canEditVisitsOnProfile = isManagement || currentUser.id === profileUser.id;
  const recentAttendance = [...staffAttendance].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  const visitStats = calculateVisitStats(staffVisits);
  const patientNameById = new Map(patients.map((p) => [p.id, p.name]));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link href={isManagement ? "/staff" : "/profile"}>
          <Button variant="ghost" size="icon" className="-ml-2" data-testid="button-back-staff-profile">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <h1 className="text-xl font-bold">Staff Profile</h1>

        {isManagement && (
          <Link href={`/staff/${profileUser.id}/edit`}>
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto"
              data-testid="button-edit-staff-profile"
            >
              <Edit2 className="h-5 w-5 text-primary" />
            </Button>
          </Link>
        )}
      </div>

      <div className="rounded-2xl border border-border/60 bg-white shadow-sm p-5" data-testid="card-staff-header">
        <div className="text-sm text-muted-foreground" data-testid="text-staff-header-label">Staff</div>
        <div className="mt-1 text-2xl font-bold text-foreground" data-testid="text-staff-name">{profileUser.name}</div>
        <div className="mt-2 flex flex-wrap gap-2">
          <div className="px-3 py-1 rounded-full bg-black text-white text-xs font-semibold" data-testid="badge-staff-role">
            {profileUser.role}
          </div>
          <div className="px-3 py-1 rounded-full bg-muted/20 text-foreground text-xs font-semibold" data-testid="badge-staff-branch">
            {profileUser.branch || "Head Office"}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">Performance Overview</h3>
        <VisitStatsCards stats={visitStats} />
      </div>

      <Card className="bg-white border border-border/60 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Stethoscope className="h-4 w-4 text-primary" />
            Patient visits
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 max-h-72 overflow-y-auto no-scrollbar">
          {staffVisits.length === 0 && (
            <p className="text-sm text-muted-foreground">No visits as treating staff yet.</p>
          )}
          {staffVisits.map((visit) => (
            <div
              key={visit.id}
              className="flex items-start justify-between gap-2 border rounded-lg p-3"
              data-testid={`card-staff-profile-visit-${visit.id}`}
            >
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex justify-between text-sm font-semibold gap-2">
                  <span>Session #{visit.sessionNumber}</span>
                  <span className="shrink-0">{format(new Date(visit.visitDate), "dd MMM yyyy")}</span>
                </div>
                <div className="text-sm text-muted-foreground line-clamp-2">{visit.condition}</div>
                <div className="text-xs text-foreground/80">
                  Patient: {patientNameById.get(visit.patientId) || "Unknown"}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs pt-0.5">
                  <span className="uppercase tracking-wide text-muted-foreground">
                    {visit.branch} · {visit.visitType}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full font-medium ${visit.paymentStatus === "Paid" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}
                  >
                    {visit.paymentStatus}
                  </span>
                </div>
              </div>
              {canEditVisitsOnProfile ? (
                <Link href={`/visits/edit/${visit.id}`}>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    data-testid={`button-edit-staff-profile-visit-${visit.id}`}
                    aria-label="Edit visit"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </Link>
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="bg-white border border-border/60 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 text-sm">
          <div className="flex justify-between border-b pb-2">
            <span className="text-muted-foreground">Email</span>
            <span className="font-medium">{profileUser.email}</span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span className="text-muted-foreground">Phone</span>
            <span className="font-medium">{profileUser.phone || "-"}</span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span className="text-muted-foreground">NIC</span>
            <span className="font-medium">{profileUser.nic || "-"}</span>
          </div>
          <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:items-center border-b pb-2">
            <span className="text-muted-foreground">Address</span>
            <span className="font-medium text-right min-w-0 break-words sm:max-w-[60%]">{profileUser.address || "-"}</span>
          </div>
          <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:items-center">
            <span className="text-muted-foreground">Degree</span>
            <span className="font-medium text-right min-w-0 break-words sm:max-w-[60%]">{profileUser.degree || "-"}</span>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white border border-border/60 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarCheck className="h-4 w-4 text-primary" />
            Recent Attendance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 max-h-64 overflow-y-auto no-scrollbar">
          {recentAttendance.length === 0 && <p className="text-sm text-muted-foreground">No records.</p>}
          {recentAttendance.slice(0, 5).map((record) => (
            <div key={record.id} className="flex items-center justify-between border-b last:border-0 pb-2 last:pb-0">
              <span className="text-sm font-medium">{format(new Date(record.date), "EEE, dd MMM")}</span>
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                  record.status === "Present" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                }`}
              >
                {record.status}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
