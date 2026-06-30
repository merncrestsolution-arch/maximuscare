import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Loader2, MapPin, ExternalLink, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { attendanceApi } from "@/lib/api";

/**
 * Single staff member's captured check-in location, resolved from an unguessable,
 * signed short-link token. The page is strictly single-record-scoped — it never
 * lists or exposes any other staff member's data. The backing endpoint enforces
 * Admin/MD-only access (an authenticated session is required), so opening this page
 * as any other role surfaces an access-denied state.
 */
export default function AttendanceLocationPage() {
  const params = useParams<{ token: string }>();
  const token = params.token ?? "";

  const { data, isLoading, error } = useQuery({
    queryKey: ["attendance-location", token],
    queryFn: () => attendanceApi.location(token),
    enabled: !!token,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading location…
      </div>
    );
  }

  if (error || !data) {
    const message = error instanceof Error ? error.message : "";
    const forbidden = /403|forbidden/i.test(message);
    return (
      <div className="mx-auto max-w-md py-16">
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="h-5 w-5" />
              {forbidden ? "Access denied" : "Location unavailable"}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {forbidden
              ? "You do not have permission to view this location. Only Admin and MD can open staff location links."
              : "This location link is invalid, expired, or the attendance record has no captured location."}
          </CardContent>
        </Card>
      </div>
    );
  }

  const lat = data.latitude;
  const lng = data.longitude;
  const mapsEmbed = `https://maps.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}&z=16&output=embed`;
  const mapsLink = `https://www.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}`;

  return (
    <div className="mx-auto max-w-2xl space-y-4 py-4">
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            {data.staffName}
          </CardTitle>
          <div className="text-sm text-muted-foreground space-y-0.5">
            <div>{data.role}</div>
            <div>
              {data.date ? format(new Date(data.date), "EEE, dd MMM yyyy") : ""}
              {data.checkInTime ? ` · In: ${format(new Date(data.checkInTime), "hh:mm a")}` : ""}
            </div>
            {data.locationLabel && <div>{data.locationLabel}</div>}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="overflow-hidden rounded-lg border border-border/60">
            <iframe
              title={`Location of ${data.staffName}`}
              src={mapsEmbed}
              className="h-[360px] w-full"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs text-muted-foreground">
              {Number(lat).toFixed(6)}, {Number(lng).toFixed(6)}
            </div>
            <Button asChild variant="outline" size="sm">
              <a href={mapsLink} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-1" /> Open in Google Maps
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
