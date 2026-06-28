import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Accent = "primary" | "success" | "warning" | "danger" | "neutral" | "secondary";

const accentMap: Record<Accent, { border: string; icon: string; value: string }> = {
  primary: { border: "border-l-primary", icon: "text-primary bg-primary/10", value: "text-foreground" },
  success: { border: "border-l-emerald-500", icon: "text-emerald-600 bg-emerald-50", value: "text-emerald-700" },
  warning: { border: "border-l-amber-500", icon: "text-amber-600 bg-amber-50", value: "text-amber-700" },
  danger: { border: "border-l-red-500", icon: "text-red-600 bg-red-50", value: "text-red-700" },
  neutral: { border: "border-l-muted-foreground/30", icon: "text-muted-foreground bg-muted", value: "text-foreground" },
  secondary: { border: "border-l-secondary", icon: "text-secondary bg-secondary/10", value: "text-foreground" },
};

type Props = {
  title: string;
  value: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  accent?: Accent;
  className?: string;
  testId?: string;
};

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  accent = "neutral",
  className,
  testId,
}: Props) {
  return (
    <Card
      className={cn(
        "min-w-0 overflow-hidden shadow-md hover:shadow-lg transition-all duration-200 animate-in fade-in-0 slide-in-from-bottom-1 text-white border-0",
        className,
      )}
      style={{
        background: "linear-gradient(135deg, #1873A8 0%, #105691 100%)"
      }}
      data-testid={testId}
    >
      <CardContent className="p-4 sm:p-5">
        {/* Accent line on stat card */}
        <div className="w-10 h-1 bg-[#F45627] rounded-sm mb-3" />
        
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-[0.75rem] font-bold text-white/80 uppercase tracking-wider leading-snug">{title}</p>
            <div className="text-2xl sm:text-3xl font-extrabold tracking-tight tabular-nums text-white">
              {value}
            </div>
            {subtitle && (
              <div className="text-xs text-white/70 pt-0.5">{subtitle}</div>
            )}
          </div>
          {icon && (
            <div className="shrink-0 rounded-xl p-2.5 bg-white/10 text-white">
              {icon}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/** Standard responsive KPI grid: 1 col mobile, 2 tablet, 4 desktop */
export function KpiGrid({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("grid w-full min-w-0 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4", className)}>
      {children}
    </div>
  );
}
