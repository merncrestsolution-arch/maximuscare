import React, { createContext, useContext, useEffect, useState } from "react";
import defaultLogo from "@assets/215e8e36-1d78-4eeb-b7c3-eb908ab749e8_1769436217800.jpeg";

interface BrandingContextType {
  logoUri: string;
  setLogoUri: (uri: string) => void;
}

const BrandingContext = createContext<BrandingContextType | undefined>(undefined);

const STORAGE_KEY = "maximus_logo_uri";

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const [logoUri, setLogoUriState] = useState<string>(defaultLogo);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setLogoUriState(stored);
    }
  }, []);

  const setLogoUri = (uri: string) => {
    setLogoUriState(uri);
    localStorage.setItem(STORAGE_KEY, uri);
  };

  return (
    <BrandingContext.Provider value={{ logoUri, setLogoUri }}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  const ctx = useContext(BrandingContext);
  if (!ctx) throw new Error("useBranding must be used within BrandingProvider");
  return ctx;
}
