import { cn } from "@/lib/utils";

export function SaveStatus({
  isSaving,
  saved,
  className,
}: {
  isSaving: boolean;
  saved: boolean;
  className?: string;
}) {
  if (!isSaving && !saved) return null;
  return (
    <span
      className={cn(
        "text-xs font-semibold",
        isSaving ? "text-muted-foreground" : "text-emerald-600",
        className
      )}
      data-testid="save-status"
    >
      {isSaving ? "Saving..." : "Saved"}
    </span>
  );
}
