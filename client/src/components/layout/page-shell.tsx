import { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  noPadding?: boolean;
};

/** Consistent page wrapper with safe bottom clearance for mobile nav. */
export function PageShell({ title, description, actions, children, className, noPadding }: Props) {
  return (
    <div className={cn("w-full min-w-0 max-w-full space-y-4 sm:space-y-6", !noPadding && "pb-4", className)}>
      {(title || actions) && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            {title && (
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-foreground truncate">
                {title}
              </h1>
            )}
            {description && (
              <p className="text-sm sm:text-base text-muted-foreground">{description}</p>
            )}
          </div>
          {actions && <div className="flex flex-wrap gap-2 shrink-0">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
