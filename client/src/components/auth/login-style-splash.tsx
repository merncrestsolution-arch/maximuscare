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
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-gradient-to-b from-teal-50/90 via-white to-slate-50 px-4 safe-top"
      role="status"
      aria-busy="true"
      aria-live="polite"
      data-testid={dataTestId}
    >
      <div className="w-full max-w-md rounded-2xl border border-teal-800/15 bg-white/95 p-8 shadow-xl backdrop-blur-sm">
        <div className="mb-4 flex justify-center">
          <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border border-teal-700/20 bg-white shadow-md">
            <img src={logoUri} alt="Maximus Care logo" className="h-full w-full object-contain p-1" />
          </div>
        </div>
        <h1 className="text-center text-2xl font-bold text-teal-900">Maximus Care</h1>
        <p className="mt-1 text-center text-base text-teal-800/85">Physio &amp; Rehab Unit Management</p>
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
              stroke="#0d9488"
              strokeWidth="2.25"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
          <p className="mt-1 text-center text-[11px] font-medium uppercase tracking-widest text-teal-700/70">
            Vitals check
          </p>
        </div>
      </div>
    </div>
  );
}
