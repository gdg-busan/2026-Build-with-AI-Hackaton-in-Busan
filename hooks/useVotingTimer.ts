"use client";

import { useState, useEffect } from "react";
import type { EventConfig } from "@/lib/types";

export type TimerUrgency = "normal" | "warning" | "critical" | "expired" | "idle";

interface VotingTimerResult {
  remainingMs: number;
  formattedTime: string;
  urgency: TimerUrgency;
  isExpired: boolean;
  isActive: boolean;
  wasExtended: boolean;
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

export function useVotingTimer(eventConfig: EventConfig | null): VotingTimerResult {
  const [now, setNow] = useState(() => Date.now());
  const [prevDeadline, setPrevDeadline] = useState<number | null>(null);
  const [extensionDetectedAt, setExtensionDetectedAt] = useState<number | null>(null);

  // Tick every second
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Detect deadline extension during render (avoids setState-in-effect and ref-during-render)
  const currentDeadline = eventConfig?.votingDeadline?.getTime() ?? null;
  if (currentDeadline !== prevDeadline) {
    setPrevDeadline(currentDeadline);
    if (prevDeadline !== null && currentDeadline !== null && currentDeadline > prevDeadline) {
      setExtensionDetectedAt(now);
    }
  }

  const wasExtended = extensionDetectedAt !== null && now - extensionDetectedAt < 3000;

  // Not active if no config or not in a timer-eligible status
  const timerEligible =
    eventConfig?.status === "voting_p1" ||
    eventConfig?.status === "voting_p2" ||
    eventConfig?.status === "waiting";
  if (!eventConfig || !timerEligible) {
    return {
      remainingMs: 0,
      formattedTime: "00:00:00",
      urgency: "idle",
      isExpired: false,
      isActive: false,
      wasExtended: false,
    };
  }

  // No deadline set
  if (!eventConfig.votingDeadline) {
    return {
      remainingMs: 0,
      formattedTime: "00:00:00",
      urgency: "idle",
      isExpired: false,
      isActive: true,
      wasExtended: false,
    };
  }

  const remaining = eventConfig.votingDeadline.getTime() - now;
  const isExpired = remaining <= 0;

  let urgency: TimerUrgency;
  if (isExpired) {
    urgency = "expired";
  } else if (remaining < 60 * 1000) {
    urgency = "critical"; // < 1 minute
  } else if (remaining < 5 * 60 * 1000) {
    urgency = "warning"; // < 5 minutes
  } else {
    urgency = "normal";
  }

  return {
    remainingMs: Math.max(0, remaining),
    formattedTime: formatTime(remaining),
    urgency,
    isExpired,
    isActive: true,
    wasExtended,
  };
}
