import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { DATE_PRESET_LABELS, type DatePreset } from "@/lib/reportDatePresets";
import { Filter } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

type Props = {
  preset: DatePreset;
  onPresetChange: (p: DatePreset) => void;
  startDate: string;
  endDate: string;
  onStartDateChange: (v: string) => void;
  onEndDateChange: (v: string) => void;
};

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
        <>
          <div className="space-y-1 flex-1 min-w-[140px]">
            <span className="text-xs font-medium text-muted-foreground">From</span>
            <Input type="date" value={startDate} onChange={(e) => onStartDateChange(e.target.value)} className="w-full h-11" />
          </div>
          <div className="space-y-1 flex-1 min-w-[140px]">
            <span className="text-xs font-medium text-muted-foreground">To</span>
            <Input type="date" value={endDate} onChange={(e) => onEndDateChange(e.target.value)} className="w-full h-11" />
          </div>
        </>
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
