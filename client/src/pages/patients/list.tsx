import { useState } from "react";
import { usePatients } from "@/hooks/useData";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, UserPlus, Phone, MapPin, ChevronRight, Loader2, BedDouble } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function PatientsList() {
  const { data: patients = [], isLoading, error } = usePatients();
  const [search, setSearch] = useState("");
  const [, setLocation] = useLocation();

  const filteredPatients = patients.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.phone.includes(search)
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Failed to load patients: {error instanceof Error ? error.message : 'Unknown error'}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <Button
        variant="outline"
        className="w-full h-14 justify-start gap-3 bg-white border-border shadow-sm hover:shadow-md hover:border-primary/20 transition-all"
        onClick={() => setLocation("/inpatients")}
        data-testid="button-inpatients"
      >
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
          <BedDouble className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 text-left">
          <div className="font-semibold text-foreground">In-Patients</div>
          <div className="text-xs text-muted-foreground">View admitted patients</div>
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground/40" />
      </Button>

      <div className="flex items-center justify-between gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search patients..." 
            className="pl-9 h-11 bg-card border-border shadow-sm text-base"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Link href="/patients/new">
          <Button size="icon" className="shrink-0 h-11 w-11 shadow-sm" data-testid="button-add-patient">
            <UserPlus className="h-5 w-5" />
          </Button>
        </Link>
      </div>

      <div className="space-y-3 pb-24">
        {filteredPatients.map(patient => (
          <Link key={patient.id} href={`/patients/${patient.id}`}>
            <Card className="bg-white border border-border/60 shadow-sm hover:shadow-md hover:border-primary/20 active:scale-[0.99] transition-all cursor-pointer">
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <Avatar className="h-12 w-12 shrink-0 border-2 border-background shadow-sm bg-secondary/10 text-secondary-foreground">
                    <AvatarFallback className="font-bold text-lg text-primary">{patient.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="font-bold text-lg text-foreground leading-tight truncate">{patient.name}</div>
                    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1 font-medium">
                        <Phone className="h-3.5 w-3.5" /> {patient.phone}
                      </span>
                      <Badge
                        variant="outline"
                        className="text-[10px] h-5 px-2 font-medium bg-muted/30 border-border text-foreground/80"
                        data-testid={`badge-patient-branch-${patient.id}`}
                      >
                        {patient.branch}
                      </Badge>
                      {patient.defaultVisitType && (
                        <Badge
                          variant="secondary"
                          className="text-[10px] h-5 px-2 font-semibold bg-black text-white"
                          data-testid={`badge-patient-visit-type-${patient.id}`}
                        >
                          {patient.defaultVisitType === 'Clinic' ? 'Clinic Visit' : 'Home Visit'}
                        </Badge>
                      )}
                      {patient.condition && (
                        <Badge
                          variant="secondary"
                          className="text-[10px] h-5 px-2 font-semibold bg-muted/20 text-foreground"
                          data-testid={`badge-patient-condition-${patient.id}`}
                        >
                          {patient.condition}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex flex-col items-end gap-1">
                    <Badge className={`${patient.status === 'Active' ? 'bg-success hover:bg-success/90' : 'bg-muted hover:bg-muted/90'} text-white font-semibold px-2.5`}>
                      {patient.status}
                    </Badge>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground/40" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
        {filteredPatients.length === 0 && (
           <div className="text-center py-10 text-muted-foreground bg-muted/10 rounded-lg border border-dashed">
             No patients found matching your search.
           </div>
        )}
      </div>
    </div>
  );
}
