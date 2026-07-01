import { useEffect, useState } from "react";

export function useSavedIndicator(isSuccess: boolean, durationMs: number = 2000) {
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!isSuccess) return;
    setSaved(true);
    const timeout = setTimeout(() => setSaved(false), durationMs);
    return () => clearTimeout(timeout);
  }, [isSuccess, durationMs]);

  return saved;
}
