"use client";

import { useEffect, useRef, useCallback } from "react";
import { ChatMessageItem } from "./ChatMessage";
import type { ChatMessage } from "@/shared/types";

interface MessageListProps {
  messages: ChatMessage[];
  currentUserId: string;
  loading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
}

export function MessageList({
  messages,
  currentUserId,
  loading,
  hasMore,
  onLoadMore,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const prevMessageCountRef = useRef(0);

  // Track if user is near bottom
  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const threshold = 80;
    isNearBottomRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
  }, []);

  // Auto-scroll on new messages if near bottom
  useEffect(() => {
    if (messages.length > prevMessageCountRef.current && isNearBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevMessageCountRef.current = messages.length;
  }, [messages.length]);

  // Scroll to bottom on initial load
  useEffect(() => {
    if (!loading && messages.length > 0) {
      bottomRef.current?.scrollIntoView();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  // Infinite scroll up for older messages
  const handleScrollTop = useCallback(() => {
    const el = containerRef.current;
    if (!el || !hasMore || loading) return;
    if (el.scrollTop < 50) {
      onLoadMore();
    }
  }, [hasMore, loading, onLoadMore]);

  return (
    <div
      ref={containerRef}
      onScroll={() => {
        handleScroll();
        handleScrollTop();
      }}
      className="flex-1 overflow-y-auto px-3 py-2 space-y-1 scrollbar-thin"
    >
      {/* Load more indicator */}
      {hasMore && (
        <div className="text-center py-2">
          <button
            onClick={onLoadMore}
            disabled={loading}
            className="font-mono text-[10px] text-muted-foreground/50 hover:text-primary/60 transition-colors"
          >
            {loading ? "loading..." : "// 이전 메시지 불러오기"}
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && messages.length === 0 && (
        <div className="flex items-center justify-center h-full">
          <div className="text-center space-y-2">
            <p className="font-mono text-sm text-muted-foreground/40">
              $ no_messages_yet
            </p>
            <p className="font-mono text-xs text-muted-foreground/30">
              첫 메시지를 보내보세요
            </p>
          </div>
        </div>
      )}

      {/* Messages */}
      {messages.map((msg) => (
        <ChatMessageItem
          key={msg.id}
          message={msg}
          isOwn={msg.senderId === currentUserId}
        />
      ))}

      <div ref={bottomRef} />
    </div>
  );
}
