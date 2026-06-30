import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { DATE_PRESET_LABELS, type DatePreset } from "@/lib/reportDatePresets";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { CalendarIcon, Filter } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

type Props = {
  preset: DatePreset;
  onPresetChange: (p: DatePreset) => void;
  startDate: string;
  endDate: string;
  onStartDateChange: (v: string) => void;
  onEndDateChange: (v: string) => void;
};

/** Parse a `yyyy-MM-dd` string into a local Date (no timezone shift). */
function parseYmd(value?: string): Date | undefined {
  if (!value) return undefined;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

function toYmd(date?: Date): string {
  return date ? format(date, "yyyy-MM-dd") : "";
}

function CustomRangePicker({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
}: Pick<Props, "startDate" | "endDate" | "onStartDateChange" | "onEndDateChange">) {
  const [open, setOpen] = useState(false);
  const range: DateRange | undefined = (() => {
    const from = parseYmd(startDate);
    const to = parseYmd(endDate);
    return from ? { from, to } : undefined;
  })();

  const label =
    range?.from && range?.to
      ? `${format(range.from, "dd MMM yyyy")} – ${format(range.to, "dd MMM yyyy")}`
      : range?.from
      ? `${format(range.from, "dd MMM yyyy")} – …`
      : "Pick a date range";

  return (
    <div className="space-y-1 flex-1 min-w-[200px]">
      <span className="text-xs font-medium text-muted-foreground">Date range</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full h-11 justify-start gap-2 font-normal",
              !range?.from && "text-muted-foreground",
            )}
          >
            <CalendarIcon className="h-4 w-4 shrink-0" />
            <span className="truncate">{label}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            numberOfMonths={2}
            defaultMonth={range?.from}
            selected={range}
            onSelect={(next) => {
              onStartDateChange(toYmd(next?.from));
              onEndDateChange(toYmd(next?.to));
              if (next?.from && next?.to) setOpen(false);
            }}
            autoFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

function FilterFields({
  preset,
  onPresetChange,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
}: Props) {
  return (
    <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-3">
      <div className="space-y-1 flex-1 min-w-[140px]">
        <span className="text-xs font-medium text-muted-foreground">Period</span>
        <Select value={preset} onValueChange={(v) => onPresetChange(v as DatePreset)}>
          <SelectTrigger className="w-full h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DATE_PRESET_LABELS.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {preset === "custom" && (
        <CustomRangePicker
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={onStartDateChange}
          onEndDateChange={onEndDateChange}
        />
      )}
    </div>
  );
}

export function ReportDateFilters(props: Props) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  if (!isMobile) {
    return <FilterFields {...props} />;
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" className="w-full h-11 justify-start gap-2">
          <Filter className="h-4 w-4" />
          Date filters
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-2xl pb-safe">
        <SheetHeader>
          <SheetTitle>Filter by date</SheetTitle>
        </SheetHeader>
        <div className="py-4">
          <FilterFields {...props} />
          <Button className="w-full h-11 mt-4" onClick={() => setOpen(false)}>
            Apply filters
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
