import { useMemo } from "react";
import { format, getDaysInMonth, startOfMonth } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AttendanceRecord } from "@/lib/types";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function isoDay(year: number, monthIndex: number, day: number) {
  return `${year}-${pad2(monthIndex + 1)}-${pad2(day)}`;
}

/** Map ICU weekInfo.firstDay (Mon=1 … Sun=7) to date-fns weekStartsOn (Sun=0 … Sat=6) */
function browserWeekStartsOn(): 0 | 1 | 2 | 3 | 4 | 5 | 6 {
  if (typeof Intl === "undefined" || typeof navigator === "undefined") return 0;
  try {
    const loc = new Intl.Locale(navigator.language);
    const wi = (loc as { weekInfo?: { firstDay?: number } }).weekInfo;
    if (wi?.firstDay != null && wi.firstDay >= 1 && wi.firstDay <= 7) {
      return wi.firstDay === 7 ? 0 : (wi.firstDay as 1 | 2 | 3 | 4 | 5 | 6);
    }
  } catch {
    /* ignore */
  }
  return 0;
}

function weekdayLabelsForLocale(weekStartsOn: number): string[] {
  const locale = typeof navigator !== "undefined" ? navigator.language : "en";
  const fmt = new Intl.DateTimeFormat(locale, { weekday: "narrow" });
  const refSunday = new Date(2023, 0, 1);
  const ordered: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(refSunday);
    d.setDate(refSunday.getDate() + i);
    ordered.push(fmt.format(d));
  }
  if (weekStartsOn === 0) return ordered;
  return [...ordered.slice(weekStartsOn), ...ordered.slice(0, weekStartsOn)];
}

export function MonthlyAttendanceSummary({
  staffName,
  monthLabel,
  year,
  monthIndex,
  records,
  dataTestIdPrefix,
}: {
  staffName: string;
  monthLabel: string;
  year: number;
  monthIndex: number;
  records: AttendanceRecord[];
  dataTestIdPrefix: string;
}) {
  const monthDays = useMemo(() => getDaysInMonth(new Date(year, monthIndex, 1)), [year, monthIndex]);

  const weekStartsOn = useMemo(() => browserWeekStartsOn(), []);
  const weekdayLabels = useMemo(() => weekdayLabelsForLocale(weekStartsOn), [weekStartsOn]);

  const recordByDate = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    for (const r of records) map.set(r.date, r);
    return map;
  }, [records]);

  const counts = useMemo(() => {
    let present = 0;
    let absent = 0;
    let total = 0;

    for (let d = 1; d <= monthDays; d++) {
      const key = isoDay(year, monthIndex, d);
      const rec = recordByDate.get(key);
      if (!rec) continue;
      total += 1;
      if (rec.status === "Present") present += 1;
      if (rec.status === "Absent") absent += 1;
    }

    return { present, absent, total };
  }, [monthDays, monthIndex, recordByDate, year]);

  const firstDow = useMemo(() => {
    const d = startOfMonth(new Date(year, monthIndex, 1));
    return (d.getDay() - weekStartsOn + 7) % 7;
  }, [monthIndex, year, weekStartsOn]);

  const gridCells = useMemo(() => {
    const cells: Array<
      | { type: "pad"; key: string }
      | { type: "day"; key: string; day: number; status: "Present" | "Absent" | "None" }
    > = [];

    for (let i = 0; i < firstDow; i++) cells.push({ type: "pad", key: `pad-${i}` });

    for (let d = 1; d <= monthDays; d++) {
      const key = isoDay(year, monthIndex, d);
      const rec = recordByDate.get(key);
      cells.push({
        type: "day",
        key,
        day: d,
        status: rec?.status ?? "None",
      });
    }

    return cells;
  }, [firstDow, monthDays, monthIndex, recordByDate, year]);

  return (
    <Card className="bg-white border border-border/60 shadow-sm" data-testid={`${dataTestIdPrefix}-card`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base" data-testid={`${dataTestIdPrefix}-title`}>
          {staffName}
        </CardTitle>
        <div className="text-sm text-muted-foreground" data-testid={`${dataTestIdPrefix}-month`}>
          {monthLabel}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-3" data-testid={`${dataTestIdPrefix}-counts`}>
          <div className="rounded-xl border border-border/60 bg-white p-3">
            <div className="text-xs text-muted-foreground">Present</div>
            <div className="mt-0.5 text-xl font-bold text-foreground" data-testid={`${dataTestIdPrefix}-present`}>
              {counts.present}
            </div>
          </div>
          <div className="rounded-xl border border-border/60 bg-white p-3">
            <div className="text-xs text-muted-foreground">Absent</div>
            <div className="mt-0.5 text-xl font-bold text-foreground" data-testid={`${dataTestIdPrefix}-absent`}>
              {counts.absent}
            </div>
          </div>
          <div className="rounded-xl border border-border/60 bg-white p-3">
            <div className="text-xs text-muted-foreground">Total</div>
            <div className="mt-0.5 text-xl font-bold text-foreground" data-testid={`${dataTestIdPrefix}-total`}>
              {counts.total}
            </div>
          </div>
        </div>

        <div
          className="rounded-xl border border-border/60 bg-white p-3 [color-scheme:light] dark:[color-scheme:dark]"
          data-testid={`${dataTestIdPrefix}-grid`}
        >
          <div className="grid grid-cols-7 gap-2 text-[10px] text-muted-foreground mb-2">
            {weekdayLabels.map((d, i) => (
              <div key={`w-${i}`} className="text-center font-semibold tabular-nums">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2">
            {gridCells.map((c) => {
              if (c.type === "pad") return <div key={c.key} />;

              const isP = c.status === "Present";
              const isA = c.status === "Absent";

              return (
                <div
                  key={c.key}
                  className={
                    "h-10 rounded-lg border flex flex-col items-center justify-center leading-none " +
                    (isP
                      ? "border-emerald-200 bg-emerald-50"
                      : isA
                        ? "border-red-200 bg-red-50"
                        : "border-border/60 bg-white")
                  }
                  data-testid={`${dataTestIdPrefix}-day-${c.day}`}
                >
                  <div className="text-[10px] text-muted-foreground">{c.day}</div>
                  <div
                    className={
                      "mt-0.5 text-xs font-bold " +
                      (isP ? "text-emerald-700" : isA ? "text-red-700" : "text-muted-foreground")
                    }
                  >
                    {isP ? "P" : isA ? "A" : ""}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-100 border border-emerald-200" />
              Present
            </div>
            <div className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-red-100 border border-red-200" />
              Absent
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
