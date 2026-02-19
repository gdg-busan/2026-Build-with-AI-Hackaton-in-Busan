"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { EVENT_ID } from "@/lib/constants";

interface FloatingEmoji {
  id: string;
  emoji: string;
  x: number;
}

interface CheerAnimationProps {
  teamId: string;
}

export function CheerAnimation({ teamId }: CheerAnimationProps) {
  const [floaters, setFloaters] = useState<FloatingEmoji[]>([]);
  const seenIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const cheersRef = collection(
      getFirebaseDb(),
      "events",
      EVENT_ID,
      "teams",
      teamId,
      "cheers"
    );
    const q = query(cheersRef, orderBy("createdAt", "desc"), limit(5));

    let isFirst = true;

    const unsub = onSnapshot(q, (snap) => {
      if (isFirst) {
        // Seed seenIds with existing docs so we don't animate on mount
        snap.docs.forEach((d) => seenIdsRef.current.add(d.id));
        isFirst = false;
        return;
      }

      snap.docChanges().forEach((change) => {
        if (change.type !== "added") return;
        const docId = change.doc.id;

        if (seenIdsRef.current.has(docId)) return;
        seenIdsRef.current.add(docId);

        const emoji = change.doc.data().emoji as string;
        // Use unique key to avoid React duplicate key warnings
        const floaterId = `${docId}_${Date.now()}`;
        const floater: FloatingEmoji = {
          id: floaterId,
          emoji,
          x: 20 + Math.random() * 60, // 20-80% horizontal
        };

        setFloaters((f) => [...f, floater]);
        setTimeout(() => {
          setFloaters((f) => f.filter((item) => item.id !== floaterId));
        }, 1500);
      });
    });

    return () => unsub();
  }, [teamId]);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <AnimatePresence>
        {floaters.map((floater) => (
          <motion.div
            key={floater.id}
            initial={{ opacity: 1, y: 0, scale: 0.8 }}
            animate={{ opacity: 0, y: -60, scale: 1.2 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            style={{ left: `${floater.x}%`, bottom: "20%" }}
            className="absolute text-2xl select-none"
          >
            {floater.emoji}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
