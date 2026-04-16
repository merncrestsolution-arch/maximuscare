import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function parseLocal(value: string): { day: Date; hhmm: string } {
  if (!value?.trim()) {
    const n = new Date();
    return {
      day: new Date(n.getFullYear(), n.getMonth(), n.getDate()),
      hhmm: `${pad2(n.getHours())}:${pad2(n.getMinutes())}`,
    };
  }
  const d = new Date(value);
  if (isNaN(d.getTime())) {
    const n = new Date();
    return {
      day: new Date(n.getFullYear(), n.getMonth(), n.getDate()),
      hhmm: "09:00",
    };
  }
  return {
    day: new Date(d.getFullYear(), d.getMonth(), d.getDate()),
    hhmm: `${pad2(d.getHours())}:${pad2(d.getMinutes())}`,
  };
}

function toLocalDatetimeString(day: Date, hhmm: string): string {
  const [h, m] = hhmm.split(":").map((x) => parseInt(x, 10));
  const nd = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  nd.setHours(Number.isFinite(h) ? h : 0, Number.isFinite(m) ? m : 0, 0, 0);
  return `${nd.getFullYear()}-${pad2(nd.getMonth() + 1)}-${pad2(nd.getDate())}T${pad2(nd.getHours())}:${pad2(nd.getMinutes())}`;
}

type WeekStart = 0 | 1 | 2 | 3 | 4 | 5 | 6;

function isValidHhmm(value: string): boolean {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);
}

function dayFromYmd(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map((x) => parseInt(x, 10));
  return new Date(y, m - 1, d);
}

export function AttendanceEditDateTime({
  label,
  value,
  onChange,
  optional,
  /** When optional and empty, default calendar day (e.g. attendance record date). */
  anchorDateYmd,
  testIdPrefix,
  weekStartsOn,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  optional?: boolean;
  anchorDateYmd?: string;
  testIdPrefix: string;
  weekStartsOn: WeekStart;
}) {
  const [open, setOpen] = useState(false);

  const isEmpty = optional && !value?.trim();

  const { day, hhmm } = useMemo(() => {
    if (isEmpty) {
      const base =
        anchorDateYmd && /^\d{4}-\d{2}-\d{2}$/.test(anchorDateYmd)
          ? dayFromYmd(anchorDateYmd)
          : (() => {
              const n = new Date();
              return new Date(n.getFullYear(), n.getMonth(), n.getDate());
            })();
      return { day: base, hhmm: "17:00" };
    }
    return parseLocal(value);
  }, [value, isEmpty, anchorDateYmd]);

  const [timeInput, setTimeInput] = useState(hhmm);

  useEffect(() => {
    setTimeInput(hhmm);
  }, [hhmm]);

  const commit = (nextDay: Date, nextHhmm: string) => {
    onChange(toLocalDatetimeString(nextDay, nextHhmm));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs font-semibold text-black">
          {label}
          {optional ? <span className="font-normal text-black/50"> (optional)</span> : null}
        </Label>
        {optional && !isEmpty ? (
          <button
            type="button"
            className="text-xs font-medium text-black/50 underline-offset-2 hover:text-black hover:underline"
            onClick={() => onChange("")}
            data-testid={`${testIdPrefix}-clear`}
          >
            Clear
          </button>
        ) : null}
      </div>

      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_11rem] md:items-stretch">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className={cn(
                "h-12 w-full justify-start gap-3 rounded-xl border-2 border-slate-200 bg-gradient-to-br from-white via-white to-slate-50/80 px-3 text-left font-medium text-black shadow-sm transition-all",
                "hover:border-[#2D9D8B]/50 hover:shadow-md",
                "focus-visible:ring-2 focus-visible:ring-[#2D9D8B]/35 focus-visible:ring-offset-2",
                isEmpty && "border-dashed text-black/60"
              )}
              data-testid={`${testIdPrefix}-date-trigger`}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#2D9D8B]/12 text-[#2D9D8B]">
                <CalendarIcon className="h-4 w-4" strokeWidth={2} />
              </span>
              <span className="min-w-0 flex-1 truncate text-[15px]">
                {isEmpty ? "Choose date…" : format(day, "EEE, dd MMM yyyy")}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-auto border-0 bg-transparent p-0 shadow-none"
            align="start"
            sideOffset={8}
            collisionPadding={16}
          >
            <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-2 shadow-2xl ring-1 ring-black/[0.06]">
              <Calendar
                key={isEmpty ? "empty" : value || "new"}
                mode="single"
                defaultMonth={day}
                selected={day}
                onSelect={(d) => {
                  if (!d) return;
                  const nd = new Date(d.getFullYear(), d.getMonth(), d.getDate());
                  commit(nd, hhmm);
                  setOpen(false);
                }}
                weekStartsOn={weekStartsOn}
                captionLayout="dropdown"
                startMonth={new Date(2020, 0)}
                endMonth={new Date(2036, 11)}
                className="rounded-xl border-0 [--cell-size:2.35rem]"
              />
            </div>
          </PopoverContent>
        </Popover>

        <div
          className={cn(
            "relative flex h-12 min-w-0 items-center gap-3 rounded-xl border-2 border-slate-200 bg-gradient-to-br from-white via-white to-slate-50/80 px-3 shadow-sm transition-colors",
            "focus-within:border-[#2D9D8B]/50 focus-within:shadow-md",
            isEmpty && "opacity-90"
          )}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/12 text-amber-800">
            <Clock className="h-4 w-4" strokeWidth={2} />
          </span>
          <Input
            type="time"
            value={timeInput}
            onChange={(e) => {
              const v = e.target.value;
              setTimeInput(v);
              if (isValidHhmm(v)) {
                commit(day, v);
              }
            }}
            onBlur={() => {
              if (!isValidHhmm(timeInput)) {
                setTimeInput(hhmm);
              }
            }}
            step={60}
            className="h-9 min-w-0 flex-1 appearance-none border-0 bg-transparent p-0 text-[17px] font-semibold tabular-nums tracking-tight text-black shadow-none focus-visible:ring-0 md:text-base [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-90"
            data-testid={`${testIdPrefix}-time`}
            aria-label={`${label} time`}
          />
        </div>
      </div>
    </div>
  );
}
