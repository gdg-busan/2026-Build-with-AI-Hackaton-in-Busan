"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { EventConfig } from "@/shared/types";
import { useVotingTimer } from "@/features/voting/model/useVotingTimer";

interface CountdownTimerProps {
  eventConfig: EventConfig;
}

export function CountdownTimer({ eventConfig }: CountdownTimerProps) {
  const [dotCount, setDotCount] = useState(1);
  const timer = useVotingTimer(eventConfig);

  useEffect(() => {
    const interval = setInterval(() => {
      setDotCount((prev) => (prev % 3) + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const { status } = eventConfig;

  if (status === "waiting") {
    // Deadline set during waiting → show submission countdown
    if (eventConfig.votingDeadline && !timer.isExpired) {
      const urgencyStyles = {
        normal: {
          color: "#4DAFFF",
          textShadow: "0 0 12px #4DAFFF80",
          animation: undefined as string | undefined,
        },
        warning: {
          color: "#FF6B35",
          textShadow: "0 0 16px #FF6B3580",
          animation: "pulse 2s ease-in-out infinite",
        },
        critical: {
          color: "#FF4444",
          textShadow: "0 0 20px #FF444480, 0 0 40px #FF444440",
          animation: "pulse 0.8s ease-in-out infinite",
        },
        expired: {
          color: "#FF4444",
          textShadow: "0 0 12px #FF444480",
          animation: undefined as string | undefined,
        },
        idle: {
          color: "#4DAFFF",
          textShadow: "0 0 12px #4DAFFF80",
          animation: undefined as string | undefined,
        },
      };
      const style = urgencyStyles[timer.urgency];

      return (
        <div>
          <motion.div
            className="flex items-center justify-center gap-3 py-2"
            animate={
              timer.urgency === "critical"
                ? { x: [0, -2, 2, -1, 1, 0] }
                : {}
            }
            transition={
              timer.urgency === "critical"
                ? { duration: 0.5, repeat: Infinity, repeatDelay: 1.5 }
                : {}
            }
          >
            <span
              className="font-mono text-xs uppercase tracking-widest"
              style={{ color: "#4DAFFF80" }}
            >
              submission deadline
            </span>
            <span
              className="font-mono text-2xl font-bold tabular-nums"
              style={{
                color: style.color,
                textShadow: style.textShadow,
                animation: style.animation,
              }}
            >
              {timer.formattedTime}
            </span>
          </motion.div>

          {/* Extension notification */}
          <AnimatePresence>
            {timer.wasExtended && (
              <motion.div
                initial={{ opacity: 0, y: -5, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, y: -5, height: 0 }}
                transition={{ duration: 0.3 }}
                className="flex items-center justify-center overflow-hidden"
              >
                <span
                  className="font-mono text-xs font-bold px-3 py-1 rounded-full"
                  style={{
                    color: "#4DAFFF",
                    backgroundColor: "#4DAFFF15",
                    border: "1px solid #4DAFFF40",
                    textShadow: "0 0 8px #4DAFFF60",
                  }}
                >
                  + 시간이 연장되었습니다!
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      );
    }

    if (timer.isExpired && eventConfig.votingDeadline) {
      return (
        <div className="flex items-center justify-center gap-2 py-2">
          <span
            className="font-mono text-sm font-bold"
            style={{ color: "#FF6B35", textShadow: "0 0 8px #FF6B3560" }}
          >
            제출 마감
          </span>
        </div>
      );
    }

    // No deadline → default waiting text
    return (
      <div className="flex items-center justify-center gap-2 py-2">
        <span
          className="font-mono text-sm"
          style={{ color: "#4DAFFF", textShadow: "0 0 8px #4DAFFF60" }}
        >
          <span
            className="inline-block"
            style={{ animation: "pulse 2s ease-in-out infinite" }}
          >
            투표 시작 대기 중
          </span>
          <span style={{ color: "#4DAFFF80" }}>
            {".".repeat(dotCount)}
          </span>
        </span>
      </div>
    );
  }

  if (status === "voting_p1" || status === "voting_p2") {
    if (eventConfig.votingDeadline && !timer.isExpired) {
      const urgencyStyles = {
        normal: {
          color: "#00FF88",
          textShadow: "0 0 12px #00FF8880",
          animation: undefined as string | undefined,
        },
        warning: {
          color: "#FF6B35",
          textShadow: "0 0 16px #FF6B3580",
          animation: "pulse 2s ease-in-out infinite",
        },
        critical: {
          color: "#FF4444",
          textShadow: "0 0 20px #FF444480, 0 0 40px #FF444440",
          animation: "pulse 0.8s ease-in-out infinite",
        },
        expired: {
          color: "#FF4444",
          textShadow: "0 0 12px #FF444480",
          animation: undefined as string | undefined,
        },
        idle: {
          color: "#00FF88",
          textShadow: "0 0 12px #00FF8880",
          animation: undefined as string | undefined,
        },
      };

      const style = urgencyStyles[timer.urgency];

      return (
        <div className="relative">
          <motion.div
            className="flex items-center justify-center gap-3 py-2"
            animate={
              timer.urgency === "critical"
                ? { x: [0, -2, 2, -1, 1, 0] }
                : {}
            }
            transition={
              timer.urgency === "critical"
                ? { duration: 0.5, repeat: Infinity, repeatDelay: 1.5 }
                : {}
            }
          >
            <span
              className="font-mono text-xs uppercase tracking-widest"
              style={{ color: "#00FF8880" }}
            >
              time remaining
            </span>
            <span
              className="font-mono text-2xl font-bold tabular-nums"
              style={{
                color: style.color,
                textShadow: style.textShadow,
                animation: style.animation,
              }}
            >
              {timer.formattedTime}
            </span>
          </motion.div>

          {/* Extension notification - below timer */}
          <AnimatePresence>
            {timer.wasExtended && (
              <motion.div
                initial={{ opacity: 0, y: -5, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, y: -5, height: 0 }}
                transition={{ duration: 0.3 }}
                className="flex items-center justify-center overflow-hidden"
              >
                <span
                  className="font-mono text-xs font-bold px-3 py-1 rounded-full"
                  style={{
                    color: "#4DAFFF",
                    backgroundColor: "#4DAFFF15",
                    border: "1px solid #4DAFFF40",
                    textShadow: "0 0 8px #4DAFFF60",
                  }}
                >
                  + 시간이 연장되었습니다!
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      );
    }

    if (timer.isExpired && eventConfig.votingDeadline) {
      return (
        <div className="flex items-center justify-center gap-2 py-2">
          <span
            className="font-mono text-sm font-bold"
            style={{ color: "#FF6B35", textShadow: "0 0 8px #FF6B3560" }}
          >
            시간 종료
          </span>
        </div>
      );
    }

    // Voting active but no deadline
    return (
      <div className="flex items-center justify-center gap-2 py-2">
        <span
          className="inline-block w-2 h-2 rounded-full"
          style={{
            backgroundColor: "#00FF88",
            boxShadow: "0 0 8px #00FF88",
            animation: "pulse 1.5s ease-in-out infinite",
          }}
        />
        <span
          className="font-mono text-sm"
          style={{ color: "#00FF88", textShadow: "0 0 8px #00FF8860" }}
        >
          투표 진행 중
        </span>
      </div>
    );
  }

  if (status === "closed_p1" || status === "closed_p2") {
    return (
      <div className="flex items-center justify-center gap-2 py-2">
        <span
          className="font-mono text-sm"
          style={{ color: "#FF6B3580" }}
        >
          결과 발표 대기 중
        </span>
      </div>
    );
  }

  if (status === "revealed_p1" || status === "revealed_final") {
    return (
      <div className="flex items-center justify-center gap-2 py-2">
        <span
          className="font-mono text-sm"
          style={{ color: "#00FF88", textShadow: "0 0 8px #00FF8860" }}
        >
          결과가 공개되었습니다
        </span>
      </div>
    );
  }

  return null;
}
