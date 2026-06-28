import { useBranding } from "@/context/branding-context";

export function LoginStyleSplash({
  message = "Loading…",
  "data-testid": dataTestId = "login-style-splash",
}: {
  message?: string;
  "data-testid"?: string;
}) {
  const { logoUri } = useBranding();

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center px-4 safe-top"
      style={{ background: "linear-gradient(135deg, #105691 0%, #1873A8 60%, #1B7EB7 100%)" }}
      role="status"
      aria-busy="true"
      aria-live="polite"
      data-testid={dataTestId}
    >
      <div className="w-full max-w-md rounded-2xl border border-border/40 bg-white p-8 shadow-xl">
        <div className="mb-4 flex justify-center">
          <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border border-[#EEF5FB] bg-white shadow-md">
            <img src={logoUri} alt="Maximus Care logo" className="h-full w-full object-contain p-1" />
          </div>
        </div>
        <h1 className="text-center text-2xl font-bold text-[#105691]">Maximus Care</h1>
        <p className="mt-1 text-center text-base text-[#1873A8]">Physio &amp; Rehab Unit Management</p>
        <p className="mt-6 text-center text-sm font-medium text-slate-600">{message}</p>
        <div className="mt-6 w-full rounded-lg border border-slate-200 bg-slate-50/80 px-2 py-3">
          <svg
            className="mx-auto h-14 w-full max-w-[320px]"
            viewBox="0 0 320 56"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden
          >
            <path
              className="animate-ecg-line"
              d="M4 28 H40 L48 28 L52 12 L58 44 L64 10 L70 46 L76 28 H112 L120 28 L124 14 L130 42 L136 12 L142 44 L148 28 H184 L192 28 L196 16 L202 40 L208 14 L214 42 L220 28 H256 L264 28 L268 18 L274 38 L280 16 L286 40 L292 28 H316"
              stroke="#F45627"
              strokeWidth="2.25"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
          <p className="mt-1 text-center text-[11px] font-medium uppercase tracking-widest text-[#1873A8]">
            Vitals check
          </p>
        </div>
      </div>
    </div>
  );
}
