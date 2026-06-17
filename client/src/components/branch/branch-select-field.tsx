import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBranchOptions } from "@/hooks/use-branch-options";

interface BranchSelectFieldProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  includeAll?: boolean;
  forRegistration?: boolean;
}

export function BranchSelectField({ value, onChange, disabled, className, includeAll, forRegistration }: BranchSelectFieldProps) {
  const { options } = useBranchOptions({ forRegistration });

  return (
    <Select value={value || options[0]?.value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger
        className={
          className ??
          "min-h-11 bg-background border-input text-foreground hover:bg-muted/50 focus:ring-2 focus:ring-ring"
        }
      >
        <SelectValue placeholder="Select branch" />
      </SelectTrigger>
      <SelectContent>
        {includeAll && <SelectItem value="">All branches</SelectItem>}
        {options.map((b) => (
          <SelectItem key={b.id} value={b.value}>
            {b.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
