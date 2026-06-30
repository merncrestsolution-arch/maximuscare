import { useMemo, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { usePatient, usePatientHistory } from "@/hooks/useData";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, BedDouble, FileText, Loader2, CalendarDays, MapPin } from "lucide-react";
import { format } from "date-fns";

const PAGE_SIZE = 15;

function safeDate(value: string): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : format(d, "dd MMM yyyy");
}

export default function PatientHistoryPage() {
  const [match, params] = useRoute("/patients/:id/history");
  const [, setLocation] = useLocation();
  const patientId = params?.id || "";
  const { data: patient } = usePatient(patientId);
  const { data: history, isLoading, error } = usePatientHistory(patientId);
  const [page, setPage] = useState(1);

  const items = history?.items ?? [];
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const pageItems = useMemo(
    () => items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [items, page]
  );

  if (!match) return null;

  return (
    <div className="space-y-4 pb-20">
      <div className="flex items-center gap-2 sticky top-0 bg-background/95 backdrop-blur z-10 py-2 border-b">
        <Button variant="ghost" size="icon" className="-ml-2" onClick={() => setLocation(`/patients/${patientId}`)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0">
          <h1 className="text-xl font-bold truncate">Patient History</h1>
          {patient && (
            <p className="text-xs text-muted-foreground truncate">
              {patient.name}
              {patient.patientCode ? ` · ${patient.patientCode}` : ""}
            </p>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : error ? (
        <p className="text-sm text-destructive px-1">
          Failed to load history: {error instanceof Error ? error.message : "Unknown error"}
        </p>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground bg-muted/10 rounded-lg border border-dashed">
          No previous visits recorded.
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {pageItems.map((item) => {
              const isAdmission = item.type === "admission";
              return (
                <Card key={`${item.type}-${item.id}`} className="bg-white border border-border/60 shadow-sm">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                            isAdmission ? "bg-secondary/10 text-secondary-foreground" : "bg-primary/10 text-primary"
                          }`}
                        >
                          {isAdmission ? <BedDouble className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-foreground truncate">{item.title}</div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <CalendarDays className="h-3 w-3" /> {safeDate(item.date)}
                            </span>
                            {item.branch && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" /> {item.branch}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      {item.status && (
                        <Badge variant="outline" className="shrink-0 text-[10px]">
                          {item.status}
                        </Badge>
                      )}
                    </div>

                    {item.condition && (
                      <p className="text-sm text-foreground/90">
                        <span className="text-muted-foreground">Condition: </span>
                        {item.condition}
                      </p>
                    )}
                    {item.treatment && (
                      <p className="text-sm text-muted-foreground line-clamp-3">
                        <span className="text-muted-foreground">Treatment: </span>
                        {item.treatment}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      {isAdmission && item.packageType && <span>{item.packageType}</span>}
                      {isAdmission && item.dischargeDate && (
                        <span>Discharged: {safeDate(item.dischargeDate)}</span>
                      )}
                      {!isAdmission && item.staffName && <span>Treating: {item.staffName}</span>}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages} ({items.length} records)
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
