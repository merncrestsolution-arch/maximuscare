import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { isClinicalRole } from "@shared/roles";

export interface TreatingStaffOption {
  id: string;
  name: string;
  role?: string;
  isActive?: boolean | number;
}

/**
 * Filter to active clinical staff. Falls back to the full list when no one
 * matches a clinical role (so the picker is never empty if data is unusual).
 */
export function getClinicalStaff<T extends TreatingStaffOption>(staff: T[]): T[] {
  const active = staff.filter((s) => s.isActive !== false && (s.isActive as unknown) !== 0);
  const clinical = active.filter((s) => isClinicalRole(s.role));
  const base = clinical.length > 0 ? clinical : active.length > 0 ? active : staff;
  return [...base].sort((a, b) => a.name.localeCompare(b.name));
}

interface TreatingStaffComboboxProps {
  staff: TreatingStaffOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  className?: string;
  /** When false, show every staff member instead of only clinical roles. */
  clinicalOnly?: boolean;
  "data-testid"?: string;
}

export function TreatingStaffCombobox({
  staff,
  value,
  onChange,
  placeholder = "Select staff",
  className,
  clinicalOnly = true,
  "data-testid": testId,
}: TreatingStaffComboboxProps) {
  const [open, setOpen] = useState(false);
  const options = useMemo(
    () => (clinicalOnly ? getClinicalStaff(staff) : [...staff].sort((a, b) => a.name.localeCompare(b.name))),
    [staff, clinicalOnly]
  );
  const selected = options.find((s) => s.id === value) ?? staff.find((s) => s.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between font-normal", className)}
          data-testid={testId}
        >
          <span className={cn("truncate", !selected && "text-muted-foreground")}>
            {selected ? `${selected.name}${selected.role ? ` (${selected.role})` : ""}` : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command
          filter={(itemValue, search) =>
            itemValue.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
          }
        >
          <CommandInput placeholder="Search staff…" className="text-base md:text-sm" />
          <CommandList>
            <CommandEmpty>
              <span className="flex flex-col items-center gap-1 text-muted-foreground">
                <Search className="h-4 w-4" />
                No staff found.
              </span>
            </CommandEmpty>
            <CommandGroup>
              {options.map((s) => (
                <CommandItem
                  key={s.id}
                  value={`${s.name} ${s.role ?? ""}`}
                  onSelect={() => {
                    onChange(s.id);
                    setOpen(false);
                  }}
                  data-testid={`option-staff-${s.id}`}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === s.id ? "opacity-100" : "opacity-0")} />
                  <span className="flex-1 truncate">{s.name}</span>
                  {s.role && <span className="text-xs text-muted-foreground">{s.role}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
