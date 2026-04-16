import { VisitStats } from "@/lib/stats";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Home, Building2 } from "lucide-react";

export function VisitStatsCards({ stats }: { stats: VisitStats }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Colombo */}
      <Card className="border-l-4 border-l-primary hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-primary mb-4 border-b pb-2">
            <div className="p-1.5 bg-primary/10 rounded-full">
              <MapPin className="h-5 w-5" />
            </div>
            <span className="text-sm font-bold uppercase tracking-wider">Colombo</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col p-2 rounded-lg bg-muted/30 border border-border/50">
              <span className="flex items-center gap-1.5 text-muted-foreground text-xs font-medium mb-1">
                <Home className="h-3.5 w-3.5" /> Home
              </span>
              <span className="font-extrabold text-2xl text-foreground">{stats.colomboHome}</span>
            </div>
            <div className="flex flex-col p-2 rounded-lg bg-muted/30 border border-border/50">
              <span className="flex items-center gap-1.5 text-muted-foreground text-xs font-medium mb-1">
                <Building2 className="h-3.5 w-3.5" /> Clinic
              </span>
              <span className="font-extrabold text-2xl text-foreground">{stats.colomboClinic}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bandaragama */}
      <Card className="border-l-4 border-l-secondary hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-secondary mb-4 border-b pb-2">
            <div className="p-1.5 bg-secondary/10 rounded-full">
              <MapPin className="h-5 w-5" />
            </div>
            <span className="text-sm font-bold uppercase tracking-wider">Bandaragama</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div className="flex flex-col p-2 rounded-lg bg-muted/30 border border-border/50">
              <span className="flex items-center gap-1.5 text-muted-foreground text-xs font-medium mb-1">
                <Home className="h-3.5 w-3.5" /> Home
              </span>
              <span className="font-extrabold text-2xl text-foreground">{stats.bandaragamaHome}</span>
            </div>
            <div className="flex flex-col p-2 rounded-lg bg-muted/30 border border-border/50">
              <span className="flex items-center gap-1.5 text-muted-foreground text-xs font-medium mb-1">
                <Building2 className="h-3.5 w-3.5" /> Clinic
              </span>
              <span className="font-extrabold text-2xl text-foreground">{stats.bandaragamaClinic}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
