import { cn } from "@/lib/utils";
import { getAppBuildInfo } from "@/lib/appBuildInfo";

type SiteCreditFooterProps = {
  /** `light` for pale page backgrounds; `dark` for login / blue hero backgrounds */
  variant?: "light" | "dark";
  className?: string;
};

/** Compact build info + credit line for login & dashboard home */
export function SiteCreditFooter({ variant = "light", className }: SiteCreditFooterProps) {
  const { displayVersion, buildDateLabel } = getAppBuildInfo();
  const isDark = variant === "dark";

  return (
    <footer
      className={cn(
        "flex flex-col items-center gap-2 px-4 pt-3 select-none",
        "pb-[max(0.75rem,env(safe-area-inset-bottom))]",
        className,
      )}
    >
      <div
        className={cn(
          "inline-flex max-w-full flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-xl border px-3.5 py-2 text-xs leading-tight shadow-sm",
          isDark
            ? "border-white/20 bg-white/12 text-white backdrop-blur-md"
            : "border-[#D4E4F0] bg-[#EEF5FB] text-[#1E293B]",
        )}
      >
        <span className="inline-flex items-center gap-1.5">
          <span className={cn("font-medium", isDark ? "text-white/70" : "text-[#64748B]")}>
            Updated
          </span>
          <span className={cn("font-semibold tabular-nums", isDark ? "text-white" : "text-[#105691]")}>
            {buildDateLabel}
          </span>
        </span>
        <span
          className={cn("hidden h-3.5 w-px sm:block", isDark ? "bg-white/25" : "bg-[#B8D0E4]")}
          aria-hidden
        />
        <span className="inline-flex items-center gap-1.5">
          <span className={cn("font-medium", isDark ? "text-white/70" : "text-[#64748B]")}>
            Version
          </span>
          <span className={cn("font-semibold tabular-nums", isDark ? "text-white" : "text-[#105691]")}>
            {displayVersion}
          </span>
        </span>
      </div>

      <p
        className={cn(
          "max-w-[min(100%,22rem)] text-center text-xs leading-snug",
          isDark ? "text-white/80" : "text-[#64748B]",
        )}
      >
        Powered by{" "}
        <span className={cn("font-semibold", isDark ? "text-[#F19F39]" : "text-[#F45627]")}>
          MernCrest
        </span>{" "}
        <span className={isDark ? "text-white/90" : "text-[#334155]"}>Solution (Pvt) Ltd</span>
      </p>
    </footer>
  );
}
