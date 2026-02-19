"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { EVENT_ID } from "@/lib/constants";
import type { Announcement } from "@/lib/types";

export function AnnouncementTicker() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

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
      setAnnouncements(items);
    });
    return () => unsub();
  }, []);

  if (announcements.length === 0) return null;

  const typeColor = (type: Announcement["type"]) => {
    if (type === "warning") return "#FF6B35";
    if (type === "success") return "#00FF88";
    return "#4DAFFF";
  };

  const typePrefix = (type: Announcement["type"]) => {
    if (type === "warning") return "[WARN]";
    if (type === "success") return "[OK]";
    return "[INFO]";
  };

  const tickerText = announcements
    .map((a) => `${typePrefix(a.type)} ${a.text}`)
    .join("  ///  ");

  // Determine dominant color (first announcement's color)
  const dominantColor = typeColor(announcements[0].type);

  return (
    <div
      className="w-full overflow-hidden border-b border-t"
      style={{
        borderColor: `${dominantColor}33`,
        backgroundColor: `${dominantColor}0A`,
      }}
    >
      <div className="flex items-center gap-0">
        {/* Static label */}
        <div
          className="flex-shrink-0 px-3 py-1.5 font-mono text-xs font-bold border-r"
          style={{
            color: dominantColor,
            borderColor: `${dominantColor}33`,
            textShadow: `0 0 8px ${dominantColor}80`,
          }}
        >
          BROADCAST
        </div>

        {/* Scrolling text */}
        <div className="flex-1 overflow-hidden py-1.5 relative">
          <div
            className="whitespace-nowrap font-mono text-xs"
            style={{
              animation: "ticker-scroll 30s linear infinite",
              display: "inline-block",
            }}
          >
            {[tickerText, tickerText].map((text, idx) => (
              <span key={idx} className="inline-block pr-24">
                {announcements.map((a, i) => (
                  <span key={a.id}>
                    {i > 0 && (
                      <span className="opacity-40 mx-3">///</span>
                    )}
                    <span
                      style={{
                        color: typeColor(a.type),
                        textShadow: `0 0 6px ${typeColor(a.type)}60`,
                      }}
                    >
                      {typePrefix(a.type)}
                    </span>
                    <span className="text-foreground ml-1">{a.text}</span>
                  </span>
                ))}
              </span>
            ))}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes ticker-scroll {
          0% {
            transform: translateX(0%);
          }
          100% {
            transform: translateX(-50%);
          }
        }
      `}</style>
    </div>
  );
}
