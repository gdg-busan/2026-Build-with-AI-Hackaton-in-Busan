"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

function getOnlineSnapshot(): boolean {
  return typeof navigator !== "undefined" ? navigator.onLine : true;
}

function getServerSnapshot(): boolean {
  return true;
}

function subscribeOnline(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

export function useNetworkStatus() {
  const isOnline = useSyncExternalStore(
    subscribeOnline,
    getOnlineSnapshot,
    getServerSnapshot,
  );

  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true);
      return;
    }
    if (!wasOffline) return;
    const timer = setTimeout(() => setWasOffline(false), 3000);
    return () => clearTimeout(timer);
  }, [isOnline, wasOffline]);

  return {
    isOnline,
    isReconnected: isOnline && wasOffline,
  };
}
