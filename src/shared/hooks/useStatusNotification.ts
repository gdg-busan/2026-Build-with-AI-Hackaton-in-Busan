"use client";

import { useEffect, useRef, useCallback } from "react";
import type { EventStatus } from "@/shared/types";

const STATUS_MESSAGES: Partial<Record<EventStatus, { title: string; body: string }>> = {
  voting_p1: { title: "🗳️ 투표가 시작되었습니다!", body: "지금 바로 마음에 드는 팀에 투표하세요." },
  voting_p2: { title: "🗳️ 2차 투표가 시작되었습니다!", body: "심사위원 투표가 시작되었습니다." },
  closed_p1: { title: "🔒 1차 투표가 마감되었습니다", body: "결과 발표를 기다려 주세요." },
  closed_p2: { title: "🔒 최종 투표가 마감되었습니다", body: "결과 발표를 기다려 주세요." },
  revealed_p1: { title: "🏆 TOP 10이 공개되었습니다!", body: "결과 페이지에서 확인하세요!" },
  revealed_final: { title: "🎉 최종 결과가 발표되었습니다!", body: "우승팀을 확인하세요!" },
};

let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!sharedAudioCtx || sharedAudioCtx.state === "closed") {
    sharedAudioCtx = new AudioContext();
  }
  return sharedAudioCtx;
}

function playNotificationSound() {
  try {
    const ctx = getAudioContext();
    // Resume if suspended (browser autoplay policy)
    if (ctx.state === "suspended") {
      ctx.resume();
    }

    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.connect(gain);
    gain.connect(ctx.destination);

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, ctx.currentTime);
    oscillator.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
    oscillator.frequency.setValueAtTime(1320, ctx.currentTime + 0.2);

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.4);
  } catch {
    // AudioContext not available — silent fallback
  }
}

function flashTabTitle(message: string): () => void {
  const originalTitle = document.title;
  let count = 0;

  const interval = setInterval(() => {
    if (count >= 10) {
      cleanup();
      return;
    }
    document.title = count % 2 === 0 ? `🔔 ${message}` : originalTitle;
    count++;
  }, 800);

  const handleVisibility = () => {
    if (!document.hidden) cleanup();
  };
  document.addEventListener("visibilitychange", handleVisibility);

  function cleanup() {
    clearInterval(interval);
    document.title = originalTitle;
    document.removeEventListener("visibilitychange", handleVisibility);
  }

  return cleanup;
}

export function useStatusNotification(status: EventStatus | undefined) {
  const prevStatusRef = useRef<EventStatus | undefined>(undefined);
  const permissionRef = useRef<NotificationPermission>("default");
  const flashCleanupRef = useRef<(() => void) | null>(null);

  // Request notification permission on mount
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;

    if (Notification.permission === "granted") {
      permissionRef.current = "granted";
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then((perm) => {
        permissionRef.current = perm;
      });
    }

    return () => {
      flashCleanupRef.current?.();
    };
  }, []);

  const notify = useCallback((title: string, body: string) => {
    playNotificationSound();

    if (document.hidden) {
      flashCleanupRef.current?.();
      flashCleanupRef.current = flashTabTitle(title);
    }

    if (document.hidden && permissionRef.current === "granted") {
      try {
        new Notification(title, {
          body,
          icon: "/favicon.ico",
          tag: "status-change",
        });
      } catch {
        // Notification API not available
      }
    }
  }, []);

  useEffect(() => {
    if (!status) return;

    // Skip initial mount
    if (prevStatusRef.current === undefined) {
      prevStatusRef.current = status;
      return;
    }

    // Only notify on actual changes
    if (prevStatusRef.current === status) return;
    prevStatusRef.current = status;

    const message = STATUS_MESSAGES[status];
    if (message) {
      notify(message.title, message.body);
    }
  }, [status, notify]);
}
