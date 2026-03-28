"use client";

import { useEffect, type ReactNode } from "react";
import { AuthProvider } from "@/features/auth/model/auth-context";

export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  return <AuthProvider>{children}</AuthProvider>;
}
