import { Checkbox } from "@/components/ui/checkbox";
import { useBranchOptions } from "@/hooks/use-branch-options";
import { cn } from "@/lib/utils";

interface BranchMultiSelectFieldProps {
  value: string[];
  onChange: (branchIds: string[]) => void;
  disabled?: boolean;
  className?: string;
}

export function BranchMultiSelectField({
  value,
  onChange,
  disabled,
  className,
}: BranchMultiSelectFieldProps) {
  const { options } = useBranchOptions({ forRegistration: true });
  const selected = new Set(value);

  const toggle = (id: string) => {
    if (disabled) return;
    if (selected.has(id)) {
      onChange(value.filter((v) => v !== id));
    } else {
      onChange([...value, id]);
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-xs text-muted-foreground">
        Select one or more branches this staff member can access.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-lg border border-border bg-card p-3">
        {options.map((branch) => {
          const checked = selected.has(branch.id);
          return (
            <label
              key={branch.id}
              className={cn(
                "flex items-center gap-3 rounded-md border px-3 py-2.5 cursor-pointer transition-colors",
                checked ? "border-primary bg-primary/5" : "border-transparent hover:bg-muted/50",
                disabled && "opacity-60 cursor-not-allowed"
              )}
            >
              <Checkbox
                checked={checked}
                onCheckedChange={() => toggle(branch.id)}
                disabled={disabled}
              />
              <span className="text-sm font-medium">{branch.label}</span>
            </label>
          );
        })}
      </div>
      {value.length === 0 ? (
        <p className="text-xs text-destructive">Select at least one branch.</p>
      ) : (
        <p className="text-xs text-muted-foreground">{value.length} branch(es) selected</p>
      )}
    </div>
  );
}
