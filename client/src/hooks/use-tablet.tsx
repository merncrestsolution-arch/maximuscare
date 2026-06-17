import { useEffect, useState } from "react";

const TABLET_MIN = 768;
const TABLET_MAX = 1024;

export function useIsTablet() {
  const [isTablet, setIsTablet] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    const mq = window.matchMedia(
      `(min-width: ${TABLET_MIN}px) and (max-width: ${TABLET_MAX}px)`
    );
    const onChange = () => setIsTablet(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return !!isTablet;
}
