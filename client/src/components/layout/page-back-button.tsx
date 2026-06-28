import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import { useGoToBranchSelect } from "@/hooks/use-go-to-branch-select";

/** Overview dashboards are entered from the workspace chooser. */
const OVERVIEW_PATHS = ["/maximus-overview", "/nexus-overview"];

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

/**
 * Content-area back control. Lives at the top of the page body (not the header)
 * so it's available on every page without crowding the brand header.
 */
export function PageBackButton() {
  const [location, setLocation] = useLocation();
  const goToBranchSelect = useGoToBranchSelect();

  const isOverview = OVERVIEW_PATHS.includes(location);

  const handleBack = () => {
    // From an overview dashboard, "back" returns to the workspace chooser.
    // We must clear the selected workspace first, otherwise the chooser
    // immediately redirects back to this overview.
    if (isOverview) {
      void goToBranchSelect();
      return;
    }
    if (window.history.length > 1) {
      window.history.back();
    } else {
      setLocation(getFallbackParent(location));
    }
  };

  return (
    <button
      type="button"
      onClick={handleBack}
      className="group mb-3 inline-flex items-center gap-1.5 rounded-lg border border-[#D6E8F5] bg-white px-3 py-1.5 text-sm font-semibold text-[#105691] shadow-sm transition-all hover:border-[#1873A8] hover:bg-[#EEF5FB] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1873A8]/40"
      aria-label={isOverview ? "Back to workspace selection" : "Go back"}
      data-testid="button-page-back"
    >
      <ArrowLeft className="h-4 w-4 shrink-0 transition-transform group-hover:-translate-x-0.5" />
      {isOverview ? "Workspaces" : "Back"}
    </button>
  );
}
