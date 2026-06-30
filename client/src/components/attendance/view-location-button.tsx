import { useState } from "react";
import { MapPin, Loader2 } from "lucide-react";
import { attendanceApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

/**
 * Admin/MD-only control that mints a signed, unguessable location short-link for a
 * single attendance record and opens it. The link is single-record-scoped and the
 * backing page requires an authenticated Admin/MD session, so it can never reveal
 * another staff member's location. Render this only for records that actually have
 * a captured location (location fields are stripped server-side for other roles).
 */
export function ViewLocationButton({
  attendanceId,
  className,
  label = "View Location",
}: {
  attendanceId: string;
  className?: string;
  label?: string;
}) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const open = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const { token } = await attendanceApi.locationToken(attendanceId);
      window.open(`/loc/${encodeURIComponent(token)}`, "_blank", "noopener,noreferrer");
    } catch (error: any) {
      toast({
        title: "Could not open location",
        description: error?.message || "Failed to generate location link.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={open}
      disabled={loading}
      className={
        className ??
        "inline-flex items-center gap-0.5 text-primary hover:underline disabled:opacity-60"
      }
      data-testid={`button-view-location-${attendanceId}`}
    >
      {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <MapPin className="h-3 w-3" />} {label}
    </button>
  );
}
