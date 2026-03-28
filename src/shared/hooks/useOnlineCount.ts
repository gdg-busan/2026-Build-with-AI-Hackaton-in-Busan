"use client";

import { useEffect, useState } from "react";
import { doc, setDoc, serverTimestamp, deleteDoc, collection, onSnapshot } from "firebase/firestore";
import { getFirebaseDb } from "@/shared/api/firebase";
import { EVENT_ID } from "@/shared/config/constants";

/**
 * Tracks online presence and returns live count of online users.
 * Uses Firestore presence collection: events/{eventId}/presence/{uniqueCode}
 */
export function useOnlineCount(uniqueCode: string | undefined) {
  const [onlineCount, setOnlineCount] = useState(0);

  // Register/unregister presence with heartbeat
  useEffect(() => {
    if (!uniqueCode) return;

    const presenceRef = doc(
      getFirebaseDb(),
      "events",
      EVENT_ID,
      "presence",
      uniqueCode,
    );

    const presenceData = { online: true, lastSeen: serverTimestamp() };

    setDoc(presenceRef, presenceData).catch(() => {});

    const heartbeat = setInterval(() => {
      setDoc(presenceRef, presenceData).catch(() => {});
    }, 60_000);

    return () => {
      clearInterval(heartbeat);
      deleteDoc(presenceRef).catch(() => {});
    };
  }, [uniqueCode]);

  // Listen to presence collection size via onSnapshot (efficient at ≤50 docs)
  useEffect(() => {
    if (!uniqueCode) return;

    const presenceCol = collection(
      getFirebaseDb(),
      "events",
      EVENT_ID,
      "presence",
    );

    const unsub = onSnapshot(
      presenceCol,
      (snapshot) => setOnlineCount(snapshot.size),
      () => {},
    );

    return unsub;
  }, [uniqueCode]);

  return onlineCount;
}
