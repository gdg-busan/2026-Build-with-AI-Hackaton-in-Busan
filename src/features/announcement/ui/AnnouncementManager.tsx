"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { getFirebaseDb } from "@/shared/api/firebase";
import { EVENT_ID } from "@/shared/config/constants";
import type { Announcement } from "@/shared/types";
import { AnnouncementOverlay } from "./AnnouncementOverlay";
import { AnnouncementTicker } from "./AnnouncementTicker";

export function AnnouncementManager() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [overlayAnnouncement, setOverlayAnnouncement] = useState<Announcement | null>(null);
  const prevIdsRef = useRef<Set<string>>(new Set());
  const isFirstLoad = useRef(true);

  useEffect(() => {
    const q = query(
      collection(getFirebaseDb(), "events", EVENT_ID, "announcements"),
      where("active", "==", true)
    );
    const unsub = onSnapshot(q, (snap) => {
      const now = new Date();
      const items: Announcement[] = snap.docs
        .map((d) => ({
          id: d.id,
          text: d.data().text as string,
          type: d.data().type as "info" | "warning" | "success",
          createdAt: d.data().createdAt?.toDate() ?? new Date(),
          expiresAt: d.data().expiresAt?.toDate() ?? null,
          active: d.data().active as boolean,
        }))
        .filter((a) => !a.expiresAt || a.expiresAt > now)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

      // Detect new announcements (not on first load)
      const currentIds = new Set(items.map((a) => a.id));
      if (!isFirstLoad.current) {
        const newItems = items.filter((a) => !prevIdsRef.current.has(a.id));
        if (newItems.length > 0) {
          // Show the most recent new announcement in overlay
          const latest = newItems[newItems.length - 1];
          setOverlayAnnouncement(latest);
        }
      } else {
        isFirstLoad.current = false;
      }
      prevIdsRef.current = currentIds;
      setAnnouncements(items);
    });
    return () => unsub();
  }, []);

  const handleOverlayDismiss = useCallback(() => {
    setOverlayAnnouncement(null);
  }, []);

  return (
    <>
      {/* Full-screen overlay for new announcements - rendered via portal-like fixed positioning */}
      <AnnouncementOverlay
        announcement={overlayAnnouncement}
        onDismiss={handleOverlayDismiss}
      />
      {/* Inline ticker banner */}
      <AnnouncementTicker announcements={announcements} />
    </>
  );
}
