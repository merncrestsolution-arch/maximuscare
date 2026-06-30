import * as React from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Standardized list-row card so every list page (Patients, In-Patients, …) shares
 * the same padding, alignment, and hover treatment instead of re-implementing it
 * per page. The left slot holds the tap target; the right slot holds action icons
 * which are bottom/right aligned consistently.
 */
export function ListCard({
  children,
  className,
  contentClassName,
  ...props
}: {
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <Card
      className={cn(
        "bg-white border border-border/60 shadow-sm hover:shadow-md hover:border-primary/20 active:scale-[0.99] transition-all",
        className
      )}
      {...props}
    >
      <CardContent className={cn("p-4 flex items-center justify-between gap-3", contentClassName)}>
        {children}
      </CardContent>
    </Card>
  );
}
