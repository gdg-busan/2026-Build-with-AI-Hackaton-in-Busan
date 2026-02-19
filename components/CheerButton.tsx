"use client";

import { useState, useEffect } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { getFirebaseAuth } from "@/lib/firebase";
import { EVENT_ID } from "@/lib/constants";
import { toast } from "sonner";

const EMOJIS = ["🔥", "❤️", "👏", "🎉"];

interface CheerButtonProps {
  teamId: string;
}

export function CheerButton({ teamId }: CheerButtonProps) {
  const [cooldown, setCooldown] = useState(false);
  const [emojiCounts, setEmojiCounts] = useState<Record<string, number>>({});

  // Subscribe to cheers subcollection for emoji breakdown
  useEffect(() => {
    const cheersRef = collection(
      getFirebaseDb(),
      "events",
      EVENT_ID,
      "teams",
      teamId,
      "cheers"
    );
    const unsub = onSnapshot(cheersRef, (snap) => {
      const counts: Record<string, number> = {};
      snap.docs.forEach((d) => {
        const emoji = d.data().emoji as string;
        counts[emoji] = (counts[emoji] ?? 0) + 1;
      });
      setEmojiCounts(counts);
    });
    return () => unsub();
  }, [teamId]);

  const handleCheer = async (emoji: string) => {
    if (cooldown) return;

    setCooldown(true);
    setTimeout(() => setCooldown(false), 3000);

    try {
      const token = await getFirebaseAuth().currentUser?.getIdToken();
      if (!token) {
        toast.error("인증 토큰을 가져올 수 없습니다");
        return;
      }

      const res = await fetch("/api/cheer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ teamId, emoji }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "응원에 실패했습니다");
      }
    } catch {
      toast.error("응원에 실패했습니다");
    }
  };

  return (
    <div
      className="flex items-center gap-1 mt-2"
      onClick={(e) => e.stopPropagation()}
    >
      {EMOJIS.map((emoji) => {
        const count = emojiCounts[emoji] ?? 0;
        return (
          <button
            key={emoji}
            onClick={() => handleCheer(emoji)}
            disabled={cooldown}
            className={`inline-flex items-center gap-0.5 text-base leading-none px-1.5 py-0.5 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              count > 0
                ? "bg-white/5 border border-border/50 hover:bg-white/10"
                : "hover:bg-white/10"
            }`}
            aria-label={`${emoji} 응원`}
          >
            {emoji}
            {count > 0 && (
              <span className="text-[10px] font-mono text-muted-foreground ml-0.5">
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
