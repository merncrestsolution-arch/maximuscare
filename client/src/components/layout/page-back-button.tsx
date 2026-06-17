import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";

/** Parent route fallbacks when browser history is empty. */
function getFallbackParent(path: string): string {
  if (path.startsWith("/patients/") && path.endsWith("/edit")) return path.replace(/\/edit$/, "");
  if (path.match(/^\/patients\/[^/]+$/)) return "/patients";
  if (path.startsWith("/staff/") && path.endsWith("/edit")) return path.replace(/\/edit$/, "");
  if (path.match(/^\/staff\/[^/]+$/)) return "/staff";
  if (path.startsWith("/visits/")) return "/dashboard";
  if (path.startsWith("/appointments/")) return "/appointments";
  if (path.startsWith("/inpatients/")) return "/inpatients";
  if (path.startsWith("/expenses/")) return "/expenses";
  if (path.startsWith("/reports/")) return "/reports";
  if (path.startsWith("/salary/")) return "/salary";
  if (path === "/patients/new") return "/patients";
  if (path === "/staff/new") return "/staff";
  return "/dashboard";
}

export function PageBackButton() {
  const [location, setLocation] = useLocation();

  const handleBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      setLocation(getFallbackParent(location));
    }
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={handleBack}
      className="h-11 w-11 shrink-0 text-white hover:bg-white/10 md:text-foreground md:hover:bg-muted"
      aria-label="Go back"
    >
      <ArrowLeft className="h-5 w-5" />
    </Button>
  );
}
