"use client";

import { useEffect, useState } from "react";
import { doc, setDoc, serverTimestamp, deleteDoc, collection, onSnapshot, type Timestamp } from "firebase/firestore";
import { getFirebaseDb } from "@/shared/api/firebase";
import { EVENT_ID } from "@/shared/config/constants";

const HEARTBEAT_INTERVAL = 60_000; // 1 minute
const STALE_THRESHOLD = 2 * 60_000; // 2 minutes — docs older than this are considered offline

/**
 * Tracks online presence and returns live count of online users.
 * Uses Firestore presence collection: events/{eventId}/presence/{uniqueCode}
 * Filters out stale docs (lastSeen > 2 min ago) to handle zombie sessions.
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
    }, HEARTBEAT_INTERVAL);

    return () => {
      clearInterval(heartbeat);
      deleteDoc(presenceRef).catch(() => {});
    };
  }, [uniqueCode]);

  // Listen to presence collection, filter stale docs client-side
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
      (snapshot) => {
        const now = Date.now();
        const activeCount = snapshot.docs.filter((d) => {
          const lastSeen = d.data().lastSeen as Timestamp | null;
          if (!lastSeen) return false;
          return now - lastSeen.toMillis() < STALE_THRESHOLD;
        }).length;
        setOnlineCount(activeCount);
      },
      () => {},
    );

    return unsub;
  }, [uniqueCode]);

  return onlineCount;
}
