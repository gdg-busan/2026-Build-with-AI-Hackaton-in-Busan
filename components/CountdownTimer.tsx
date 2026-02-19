"use client";

import { useEffect, useState } from "react";
import type { EventConfig } from "@/lib/types";

interface CountdownTimerProps {
  eventConfig: EventConfig;
}

function formatTime(ms: number): string {
  if (ms <= 0) return "00:00:00";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds]
    .map((v) => String(v).padStart(2, "0"))
    .join(":");
}

export function CountdownTimer({ eventConfig }: CountdownTimerProps) {
  const [now, setNow] = useState(() => Date.now());
  const [dotCount, setDotCount] = useState(1);

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
      setDotCount((prev) => (prev % 3) + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const { status, votingDeadline } = eventConfig;

  if (status === "waiting") {
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

  if (status === "voting") {
    if (votingDeadline) {
      const remaining = votingDeadline.getTime() - now;
      const isUrgent = remaining > 0 && remaining < 5 * 60 * 1000; // < 5 min

      return (
        <div className="flex items-center justify-center gap-3 py-2">
          <span
            className="font-mono text-xs uppercase tracking-widest"
            style={{ color: "#00FF8880" }}
          >
            time remaining
          </span>
          <span
            className="font-mono text-2xl font-bold tabular-nums"
            style={{
              color: isUrgent ? "#FF6B35" : "#00FF88",
              textShadow: isUrgent
                ? "0 0 12px #FF6B3580"
                : "0 0 12px #00FF8880",
              animation: isUrgent ? "pulse 1s ease-in-out infinite" : undefined,
            }}
          >
            {formatTime(remaining)}
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

  if (status === "closed") {
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

  if (status === "revealed") {
    return (
      <div className="flex items-center justify-center gap-2 py-2">
        <span
          className="font-mono text-sm"
          style={{ color: "#00FF88", textShadow: "0 0 8px #00FF8860" }}
        >
          🏆 결과가 공개되었습니다
        </span>
      </div>
    );
  }

  return null;
}
