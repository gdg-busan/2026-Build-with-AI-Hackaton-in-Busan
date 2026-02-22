"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Announcement } from "@/lib/types";
import { AnimatePresence, motion } from "framer-motion";

// Characters used for the decoding effect
const DECODE_CHARS = "!@#$%^&*()_+-=[]{}|;:,.<>?/~`01";

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return reduced;
}

/** Decoding text effect: random chars → real text */
function DecodingText({
  text,
  color,
  duration = 600,
  isNew,
}: {
  text: string;
  color: string;
  duration?: number;
  isNew: boolean;
}) {
  const [displayed, setDisplayed] = useState(text);
  const reducedMotion = useReducedMotion();
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!isNew || reducedMotion) {
      setDisplayed(text);
      return;
    }

    const startTime = performance.now();
    const chars = text.split("");

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);

      const result = chars.map((char, i) => {
        const charThreshold = i / chars.length;
        if (progress > charThreshold + 0.3 || char === " ") return char;
        return DECODE_CHARS[Math.floor(Math.random() * DECODE_CHARS.length)];
      });

      setDisplayed(result.join(""));

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayed(text);
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [text, isNew, duration, reducedMotion]);

  return (
    <span
      className="font-mono"
      style={{
        color,
        textShadow: isNew ? `0 0 8px ${color}80` : `0 0 4px ${color}40`,
      }}
    >
      {displayed}
    </span>
  );
}

/** Scanline sweep overlay */
function ScanlineSweep({ color, trigger }: { color: string; trigger: number }) {
  const reducedMotion = useReducedMotion();
  if (reducedMotion) return null;

  return (
    <AnimatePresence>
      {trigger > 0 && (
        <motion.div
          key={trigger}
          className="absolute inset-0 pointer-events-none z-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="absolute top-0 bottom-0 w-[2px]"
            style={{
              background: `linear-gradient(to bottom, transparent, ${color}, transparent)`,
              boxShadow: `0 0 12px 4px ${color}60`,
            }}
            initial={{ left: "-2%" }}
            animate={{ left: "102%" }}
            transition={{ duration: 0.6, ease: "easeInOut" }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Pulsing signal dot */
function SignalDot({ color }: { color: string }) {
  return (
    <span className="relative inline-flex h-2 w-2 ml-1.5 mr-0.5">
      <span
        className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60"
        style={{ backgroundColor: color }}
      />
      <span
        className="relative inline-flex rounded-full h-2 w-2"
        style={{
          backgroundColor: color,
          boxShadow: `0 0 6px ${color}`,
        }}
      />
    </span>
  );
}

// Framer Motion variants
const bannerVariants = {
  hidden: { y: -80, opacity: 0, filter: "blur(6px)" },
  visible: {
    y: 0,
    opacity: 1,
    filter: "blur(0px)",
    transition: { type: "spring" as const, stiffness: 280, damping: 26 },
  },
  exit: {
    y: -40,
    opacity: 0,
    filter: "blur(4px)",
    transition: { duration: 0.25 },
  },
};

const bannerReducedVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.3 } },
  exit: { opacity: 0, transition: { duration: 0.2 } },
};

interface AnnouncementTickerProps {
  announcements: Announcement[];
}

export function AnnouncementTicker({ announcements }: AnnouncementTickerProps) {
  const [sweepTrigger, setSweepTrigger] = useState(0);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const prevIdsRef = useRef<Set<string>>(new Set());
  const isFirstLoad = useRef(true);
  const reducedMotion = useReducedMotion();

  // Detect new announcements when props change
  useEffect(() => {
    const currentIds = new Set(announcements.map((a) => a.id));
    if (!isFirstLoad.current) {
      const freshIds = new Set<string>();
      for (const id of currentIds) {
        if (!prevIdsRef.current.has(id)) freshIds.add(id);
      }
      if (freshIds.size > 0) {
        setNewIds(freshIds);
        setSweepTrigger((t) => t + 1);
        setTimeout(() => setNewIds(new Set()), 1200);
      }
    } else {
      isFirstLoad.current = false;
    }
    prevIdsRef.current = currentIds;
  }, [announcements]);

  const typeColor = useCallback((type: Announcement["type"]) => {
    if (type === "warning") return "#FF6B35";
    if (type === "success") return "#00FF88";
    return "#4DAFFF";
  }, []);

  const typePrefix = useCallback((type: Announcement["type"]) => {
    if (type === "warning") return "[WARN]";
    if (type === "success") return "[OK]";
    return "[INFO]";
  }, []);

  const dominantColor =
    announcements.length > 0 ? typeColor(announcements[0].type) : "#4DAFFF";

  const hasAnnouncements = announcements.length > 0;

  return (
    <AnimatePresence mode="wait">
      {hasAnnouncements && (
        <motion.div
          key="announcement-ticker"
          variants={reducedMotion ? bannerReducedVariants : bannerVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="w-full overflow-hidden border-b border-t relative"
          style={{
            borderColor: `${dominantColor}33`,
            backgroundColor: `${dominantColor}0A`,
          }}
        >
          {/* Scanline sweep on new announcement */}
          <ScanlineSweep color={dominantColor} trigger={sweepTrigger} />

          {/* Brief flash overlay on new announcement */}
          <AnimatePresence>
            {sweepTrigger > 0 && !reducedMotion && (
              <motion.div
                key={`flash-${sweepTrigger}`}
                className="absolute inset-0 pointer-events-none z-[5]"
                style={{ backgroundColor: dominantColor }}
                initial={{ opacity: 0.15 }}
                animate={{ opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
              />
            )}
          </AnimatePresence>

          <div className="flex items-center gap-0 relative z-20">
            {/* Static label with signal dot */}
            <div
              className="flex-shrink-0 px-3 py-1.5 font-mono text-xs font-bold border-r flex items-center"
              style={{
                color: dominantColor,
                borderColor: `${dominantColor}33`,
                textShadow: `0 0 8px ${dominantColor}80`,
              }}
            >
              <span>BROADCAST</span>
              <SignalDot color={dominantColor} />
            </div>

            {/* Scrolling text with decoding effect */}
            <div className="flex-1 overflow-hidden py-1.5 relative">
              <div
                className="whitespace-nowrap font-mono text-xs"
                style={{
                  animation: "ticker-scroll 30s linear infinite",
                  display: "inline-block",
                }}
              >
                {[0, 1].map((idx) => (
                  <span key={idx} className="inline-block pr-24">
                    {announcements.map((a, i) => {
                      const isNewAnnouncement = newIds.has(a.id);
                      return (
                        <span key={a.id}>
                          {i > 0 && (
                            <span className="opacity-40 mx-3">{"///"}</span>
                          )}
                          <DecodingText
                            text={typePrefix(a.type)}
                            color={typeColor(a.type)}
                            duration={400}
                            isNew={isNewAnnouncement}
                          />
                          <span className="ml-1">
                            <DecodingText
                              text={a.text}
                              color="var(--foreground)"
                              duration={600}
                              isNew={isNewAnnouncement}
                            />
                          </span>
                        </span>
                      );
                    })}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Ambient glow border (bottom) */}
          <motion.div
            className="absolute bottom-0 left-0 right-0 h-[1px]"
            style={{
              background: `linear-gradient(to right, transparent, ${dominantColor}60, transparent)`,
            }}
            animate={{
              opacity: [0.4, 0.8, 0.4],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />

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
        </motion.div>
      )}
    </AnimatePresence>
  );
}
