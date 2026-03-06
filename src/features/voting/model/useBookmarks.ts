"use client";

import { useState, useCallback } from "react";

const STORAGE_KEY = "gdg-hackathon-bookmarks";

function loadBookmarks(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

export function useBookmarks() {
  const [bookmarks, setBookmarks] = useState<string[]>(loadBookmarks);

  const toggleBookmark = useCallback((teamId: string) => {
    setBookmarks((prev) => {
      const next = prev.includes(teamId)
        ? prev.filter((id) => id !== teamId)
        : [...prev, teamId];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const isBookmarked = useCallback(
    (teamId: string) => bookmarks.includes(teamId),
    [bookmarks]
  );

  return { bookmarks, toggleBookmark, isBookmarked, count: bookmarks.length };
}
