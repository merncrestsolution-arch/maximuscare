import { useState } from "react";
import { useAuth } from "@/context/auth-context";
import { useStaff } from "@/hooks/useData";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, UserPlus, Phone, MapPin, MoreVertical, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function StaffListPage() {
  const { user } = useAuth();
  const { data: staff = [], isLoading, error } = useStaff();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");

  if (!user || !['Admin', 'MD'].includes(user.role)) return <div className="p-4">Unauthorized</div>;

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
          Failed to load staff: {error instanceof Error ? error.message : 'Unknown error'}
        </AlertDescription>
      </Alert>
    );
  }

  const filteredStaff = staff.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase()) || 
    s.role.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search staff..." 
            className="pl-9 h-10 bg-background"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Link href="/staff/new">
          <Button size="icon" className="shrink-0 h-11 w-11 shadow-sm" data-testid="button-add-staff">
            <UserPlus className="h-5 w-5" />
          </Button>
        </Link>
      </div>

      <div className="space-y-3 pb-24">
        {filteredStaff.map(member => (
          <Card key={member.id} className="bg-white border border-border/60 shadow-sm active:scale-[0.99] transition-transform">
            <CardContent className="p-4 flex items-center gap-4">
              <Link href={`/staff/${member.id}`} className="flex-1 min-w-0">
                <div>
                  <div className="font-bold text-lg text-foreground truncate" data-testid={`text-staff-name-${member.id}`}>{member.name}</div>
                  <div className="text-sm text-muted-foreground flex flex-wrap items-center gap-2 mt-0.5">
                    <span className="font-medium text-foreground" data-testid={`text-staff-role-${member.id}`}>{member.role}</span>
                    {member.branch && (
                      <>
                        <span className="text-white/20">•</span>
                        <span className="flex items-center gap-1 text-xs" data-testid={`text-staff-branch-${member.id}`}>
                          <MapPin className="h-3 w-3" /> {member.branch}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </Link>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setLocation(`/staff/${member.id}/edit`)}>
                    Edit Details
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit now uses dedicated page route */}
    </div>
  );
}
