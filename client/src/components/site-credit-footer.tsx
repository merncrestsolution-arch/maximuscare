import { useId } from "react";
import { cn } from "@/lib/utils";

/** Custom mark: small sun over three soft bars — reads as “care + vitality + release” at icon size */
function CrestSunriseMark({
  className,
  gradientId,
}: {
  className?: string;
  gradientId: string;
}) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={cn("shrink-0 drop-shadow-sm", className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <linearGradient
          id={gradientId}
          x1="2"
          y1="18"
          x2="18"
          y2="2"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="hsl(174 58% 39%)" />
          <stop offset="55%" stopColor="hsl(174 52% 48%)" />
          <stop offset="100%" stopColor="hsl(12 76% 58%)" />
        </linearGradient>
      </defs>
      <g transform="rotate(-5 10 10)">
        <rect
          x="3.25"
          y="11.25"
          width="3.1"
          height="5.75"
          rx="1.45"
          fill={`url(#${gradientId})`}
          opacity={0.88}
        />
        <rect x="8.45" y="8.35" width="3.1" height="8.65" rx="1.45" fill={`url(#${gradientId})`} />
        <rect
          x="13.65"
          y="9.85"
          width="3.1"
          height="7.15"
          rx="1.45"
          fill={`url(#${gradientId})`}
          opacity={0.9}
        />
        <circle cx="10" cy="5.35" r="2.65" fill={`url(#${gradientId})`} />
      </g>
    </svg>
  );
}

/** Compact colorful footer for login & dashboard home */
export function SiteCreditFooter() {
  const uid = useId().replace(/:/g, "");
  const gradPill = `mc-crest-${uid}-pill`;
  const gradMicro = `mc-crest-${uid}-micro`;

  return (
    <div
      className="flex flex-col items-center justify-center gap-1.5 px-3 pb-safe select-none"
      aria-hidden
    >
      <div className="inline-flex max-w-[min(100%,20rem)] flex-wrap items-center justify-center gap-x-1.5 gap-y-1">
        <span className="inline-flex max-w-full items-center gap-0.5 whitespace-nowrap rounded-full border border-primary/30 bg-gradient-to-r from-primary/[0.12] via-accent/80 to-secondary/[0.14] px-1.5 py-0.5 text-[10px] font-medium tabular-nums shadow-sm ring-1 ring-primary/10">
          <CrestSunriseMark gradientId={gradPill} className="h-3 w-3" />
          <span className="text-primary">Last update</span>
          <span className="text-muted-foreground/45" aria-hidden>
            ·
          </span>
          <span className="text-secondary">2026/04/17</span>
        </span>
      </div>
      <p className="flex max-w-[min(100%,22rem)] flex-wrap items-center justify-center gap-1 text-center text-[9px] leading-snug tracking-tight text-muted-foreground/90">
        <CrestSunriseMark gradientId={gradMicro} className="h-2.5 w-2.5 opacity-90" />
        <span>
          <span className="text-primary/85">Powered by</span>{" "}
          <span className="font-semibold text-foreground/85">MernCrest</span>{" "}
          <span className="text-muted-foreground/75">Solution (Pvt) Ltd</span>
        </span>
      </p>
    </div>
  );
}
