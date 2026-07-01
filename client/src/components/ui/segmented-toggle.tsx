import { cn } from "@/lib/utils";

export type SegmentedToggleOption<T extends string> = {
  value: T;
  label: string;
  mobileLabel?: string;
  testId?: string;
};

type SegmentedToggleProps<T extends string> = {
  value: T;
  onChange: (value: T) => void;
  options: SegmentedToggleOption<T>[];
  className?: string;
};

/** Full-width segmented control — short labels on mobile, full labels on sm+. */
export function SegmentedToggle<T extends string>({
  value,
  onChange,
  options,
  className,
}: SegmentedToggleProps<T>) {
  return (
    <div
      className={cn(
        "grid w-full gap-1 rounded-xl border border-[#D6E8F5] bg-[#F8FBFE] p-1",
        className,
      )}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      role="tablist"
    >
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            data-testid={opt.testId}
            onClick={() => onChange(opt.value)}
            className={cn(
              "rounded-lg px-2 py-2.5 text-center text-xs font-semibold leading-tight transition-all sm:px-3 sm:py-2 sm:text-sm",
              active
                ? "bg-[#105691] text-white shadow-sm"
                : "text-[#64748B] hover:bg-white hover:text-[#105691]",
            )}
          >
            <span className="sm:hidden">{opt.mobileLabel ?? opt.label}</span>
            <span className="hidden sm:inline">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
