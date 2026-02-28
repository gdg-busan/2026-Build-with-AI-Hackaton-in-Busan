"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

interface AnnouncementOverlayProps {
  announcement: {
    id: string;
    text: string;
    type: "info" | "warning" | "success";
  } | null;
  onDismiss: () => void;
}

const TYPE_CONFIG = {
  info: {
    color: "#4DAFFF",
    label: "[INFO]",
    borderColor: "rgba(77, 175, 255, 0.4)",
    glow: "0 0 20px rgba(77, 175, 255, 0.5), 0 0 40px rgba(77, 175, 255, 0.2)",
    pulseGlow:
      "0 0 30px rgba(77, 175, 255, 0.8), 0 0 60px rgba(77, 175, 255, 0.4)",
  },
  warning: {
    color: "#FF6B35",
    label: "[WARN]",
    borderColor: "rgba(255, 107, 53, 0.4)",
    glow: "0 0 20px rgba(255, 107, 53, 0.5), 0 0 40px rgba(255, 107, 53, 0.2)",
    pulseGlow:
      "0 0 30px rgba(255, 107, 53, 0.8), 0 0 60px rgba(255, 107, 53, 0.4)",
  },
  success: {
    color: "#00FF88",
    label: "[OK]",
    borderColor: "rgba(0, 255, 136, 0.4)",
    glow: "0 0 20px rgba(0, 255, 136, 0.5), 0 0 40px rgba(0, 255, 136, 0.2)",
    pulseGlow:
      "0 0 30px rgba(0, 255, 136, 0.8), 0 0 60px rgba(0, 255, 136, 0.4)",
  },
};

const DECODE_CHARS =
  "!@#$%^&*()_+-=[]{}|;:,.<>?/~`01ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const HEADER_TEXT = "[SYSTEM NOTICE]";
const emptySubscribe = () => () => {};

function useTypewriter(text: string, delay: number, active: boolean) {
  const [displayed, setDisplayed] = useState("");

  useEffect(() => {
    if (!active) return;
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(interval);
    }, delay);
    return () => clearInterval(interval);
  }, [text, delay, active]);

  return active ? displayed : "";
}

function useDecodingText(
  targetText: string,
  duration: number,
  active: boolean
) {
  const [displayed, setDisplayed] = useState("");
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active || !targetText) return;

    const startTime = performance.now();
    const len = targetText.length;

    function frame(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const revealedCount = Math.floor(progress * len);

      let result = "";
      for (let i = 0; i < len; i++) {
        if (i < revealedCount) {
          result += targetText[i];
        } else {
          result +=
            DECODE_CHARS[Math.floor(Math.random() * DECODE_CHARS.length)];
        }
      }
      setDisplayed(result);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(frame);
      } else {
        setDisplayed(targetText);
      }
    }

    rafRef.current = requestAnimationFrame(frame);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [targetText, duration, active]);

  return (!active || !targetText) ? "" : displayed;
}

function AnnouncementContent({
  announcement,
  onDismiss,
  reduced,
}: {
  announcement: NonNullable<AnnouncementOverlayProps["announcement"]>;
  onDismiss: () => void;
  reduced: boolean;
}) {
  const config = TYPE_CONFIG[announcement.type];
  const [active, setActive] = useState(false);
  const [scanlineDone, setScanlineDone] = useState(false);
  const [glowPulse, setGlowPulse] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setActive(true), reduced ? 0 : 300);
    return () => clearTimeout(t);
  }, [reduced]);

  useEffect(() => {
    if (scanlineDone) {
      const t = setTimeout(() => setGlowPulse((p) => !p), 0);
      return () => clearTimeout(t);
    }
  }, [scanlineDone]);

  const headerDisplayed = useTypewriter(
    HEADER_TEXT,
    50,
    active && !reduced
  );
  const bodyDisplayed = useDecodingText(
    announcement.text,
    800,
    active && !reduced
  );

  const displayHeader = reduced ? HEADER_TEXT : headerDisplayed;
  const displayBody = reduced ? announcement.text : bodyDisplayed;

  const contentVariants = {
    hidden: reduced
      ? { opacity: 0 }
      : { opacity: 0, scale: 0.9, filter: "blur(8px)" },
    visible: reduced
      ? { opacity: 1 }
      : { opacity: 1, scale: 1, filter: "blur(0px)" },
    exit: reduced
      ? { opacity: 0 }
      : { opacity: 0, scale: 0.95, filter: "blur(4px)" },
  };

  return (
    <motion.div
      key={announcement.id}
      className="fixed inset-0 z-[60] flex items-center justify-center"
      style={{ backdropFilter: "blur(2px)" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onDismiss}
    >
      {/* Dark backdrop */}
      <div className="absolute inset-0 bg-[#0A0E1A]/95" />

      {/* Dot-grid subtle bg */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.3) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      {/* Content box */}
      <motion.div
        className="relative z-10 w-full max-w-lg mx-4 rounded-lg overflow-hidden"
        style={{
          background: "#0A0E1A",
          border: `1px solid ${config.borderColor}`,
          boxShadow: glowPulse ? config.pulseGlow : config.glow,
        }}
        variants={contentVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        transition={
          reduced
            ? { duration: 0.3 }
            : { type: "spring" as const, stiffness: 300, damping: 25 }
        }
        onClick={(e) => e.stopPropagation()}
      >
        {/* Scanline sweep */}
        {!reduced && (
          <motion.div
            className="absolute inset-x-0 z-20 pointer-events-none"
            style={{
              height: "2px",
              background: `linear-gradient(90deg, transparent, ${config.color}, transparent)`,
              boxShadow: `0 0 8px ${config.color}`,
            }}
            initial={{ top: "-10%" }}
            animate={{ top: "110%" }}
            transition={{ duration: 0.5, delay: 0.1, ease: "linear" }}
            onAnimationComplete={() => setScanlineDone(true)}
          />
        )}

        {/* Glow pulse animation */}
        <motion.div
          className="absolute inset-0 rounded-lg pointer-events-none z-0"
          animate={{
            boxShadow: [config.glow, config.pulseGlow, config.glow],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 0.8,
          }}
        />

        <div className="relative z-10 p-6 font-mono">
          {/* Header */}
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-white/10">
            <motion.span
              className="text-xs font-bold tracking-widest"
              style={{ color: config.color }}
              animate={{ opacity: [1, 0.6, 1] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            >
              ▰
            </motion.span>
            <span
              className="text-sm font-bold tracking-wider"
              style={{
                color: config.color,
                textShadow: `0 0 8px ${config.color}`,
              }}
            >
              {displayHeader}
              {!reduced && displayHeader.length < HEADER_TEXT.length && (
                <motion.span
                  animate={{ opacity: [1, 0] }}
                  transition={{ duration: 0.5, repeat: Infinity }}
                >
                  _
                </motion.span>
              )}
            </span>
          </div>

          {/* Announcement body */}
          <div className="mb-6">
            <span
              className="text-xs font-bold mr-2"
              style={{
                color: config.color,
                textShadow: `0 0 6px ${config.color}`,
              }}
            >
              {config.label}
            </span>
            <span
              className="text-sm text-white/90 leading-relaxed"
              role="alert"
              aria-live="assertive"
            >
              {displayBody}
            </span>
          </div>

          {/* Dismiss hint */}
          <motion.div
            className="flex items-center gap-2 text-xs text-white/30"
            animate={{ opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            <span style={{ color: config.color }}>▸</span>
            <span>tap to dismiss</span>
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function AnnouncementOverlay({
  announcement,
  onDismiss,
}: AnnouncementOverlayProps) {
  const reduced = useReducedMotion() ?? false;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  const handleDismiss = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    onDismiss();
  }, [onDismiss]);

  useEffect(() => {
    if (!announcement) return;
    timerRef.current = setTimeout(() => {
      onDismiss();
    }, 3000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [announcement, onDismiss]);

  // Portal to body so it escapes any parent overflow/stacking context
  if (!mounted) return null;

  return createPortal(
    <AnimatePresence mode="wait">
      {announcement && (
        <AnnouncementContent
          key={announcement.id}
          announcement={announcement}
          onDismiss={handleDismiss}
          reduced={reduced}
        />
      )}
    </AnimatePresence>,
    document.body
  );
}
