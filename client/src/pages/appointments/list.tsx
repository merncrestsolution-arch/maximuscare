import { useState } from "react";
import { useLocation } from "wouter";
import { useAppointments, useDeleteAppointment } from "@/hooks/useData";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Plus, Edit, Trash2, ChevronLeft, ChevronRight, Clock, User, Loader2 } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths, isSameDay, isToday } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import type { Appointment } from "@/lib/types";
import { isManagementRole } from "@/lib/permissions";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

export default function AppointmentsList() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: appointments = [], isLoading } = useAppointments();
  const deleteAppointment = useDeleteAppointment();

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const canManage = isManagementRole(user?.role);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDayOfWeek = getDay(monthStart);

  const appointmentDates = new Set(
    appointments.map((a: Appointment) => a.appointmentDate)
  );

  const selectedDateStr = format(selectedDate, "yyyy-MM-dd");
  const dayAppointments = appointments
    .filter((a: Appointment) => a.appointmentDate === selectedDateStr)
    .sort((a: Appointment, b: Appointment) => a.appointmentTime.localeCompare(b.appointmentTime));

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteAppointment.mutateAsync(deleteId);
      toast({ title: "Appointment deleted", description: "The appointment has been removed." });
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to delete appointment", variant: "destructive" });
    }
    setDeleteId(null);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" data-testid="loader-appointments" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-[720px] p-4 pb-20 md:pb-6">
        <div className="bg-white rounded-xl border border-border p-4 mb-6">
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              data-testid="button-prev-month"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <h2 className="text-lg font-bold" data-testid="text-current-month">
              {format(currentMonth, "MMMM yyyy")}
            </h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              data-testid="button-next-month"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-2">
            {DAY_LABELS.map((label, i) => (
              <div key={i} className="text-center text-xs font-medium text-muted-foreground py-1">
                {label}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: startDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} className="h-10" />
            ))}
            {daysInMonth.map((day) => {
              const dateStr = format(day, "yyyy-MM-dd");
              const isSelected = isSameDay(day, selectedDate);
              const isTodayDate = isToday(day);
              const hasAppointments = appointmentDates.has(dateStr);

              return (
                <button
                  key={dateStr}
                  onClick={() => setSelectedDate(day)}
                  className={`h-10 flex flex-col items-center justify-center rounded-full relative transition-colors ${
                    isSelected
                      ? "bg-primary/20 text-primary font-bold"
                      : isTodayDate
                      ? "bg-primary text-white font-bold"
                      : "hover:bg-muted text-foreground"
                  }`}
                  data-testid={`calendar-day-${dateStr}`}
                >
                  <span className="text-sm leading-none">{format(day, "d")}</span>
                  {hasAppointments && (
                    <span
                      className={`absolute bottom-0.5 w-1.5 h-1.5 rounded-full ${
                        isSelected ? "bg-primary" : isTodayDate ? "bg-white" : "bg-primary"
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <h3 className="text-lg font-bold mb-4" data-testid="text-appointments-header">
          Appointments for {format(selectedDate, "dd MMM yyyy")}
        </h3>

        {dayAppointments.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground" data-testid="text-no-appointments">
            No appointments for this date
          </div>
        ) : (
          <div className="space-y-3">
            {dayAppointments.map((appointment: Appointment) => (
              <div
                key={appointment.id}
                className="bg-white border border-border rounded-xl p-4 shadow-sm"
                data-testid={`card-appointment-${appointment.id}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span data-testid={`text-time-${appointment.id}`}>{appointment.appointmentTime}</span>
                    </div>
                    <div className="font-semibold text-foreground" data-testid={`text-patient-${appointment.id}`}>
                      {appointment.patientName}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <User className="h-4 w-4" />
                      <span data-testid={`text-staff-${appointment.id}`}>{appointment.treatingStaffName}</span>
                    </div>
                    {appointment.notes && (
                      <div className="text-sm text-muted-foreground mt-1" data-testid={`text-notes-${appointment.id}`}>
                        {appointment.notes}
                      </div>
                    )}
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-1 ml-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9"
                        onClick={() => setLocation(`/appointments/edit/${appointment.id}`)}
                        data-testid={`button-edit-${appointment.id}`}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-destructive hover:text-destructive"
                        onClick={() => setDeleteId(appointment.id)}
                        data-testid={`button-delete-${appointment.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="fixed bottom-20 left-0 right-0 z-10 px-4 pb-2 md:static md:z-auto md:px-0 md:pb-0">
          <div className="mx-auto max-w-[720px] md:flex md:justify-center md:pt-4">
            <Button
              className="h-11 w-full text-sm shadow-md md:h-10 md:w-auto md:min-w-[11rem]"
              onClick={() => setLocation(`/appointments/book?date=${selectedDateStr}`)}
              data-testid="button-book-appointment"
            >
              <Plus className="mr-2 h-4 w-4" />
              Book Appointment
            </Button>
          </div>
        </div>
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Appointment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this appointment? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteAppointment.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
