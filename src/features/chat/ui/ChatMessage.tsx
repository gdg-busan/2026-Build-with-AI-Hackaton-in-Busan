"use client";

import { Badge } from "@/shared/ui/badge";
import type { ChatMessage as ChatMessageType } from "@/shared/types";

interface ChatMessageProps {
  message: ChatMessageType;
  isOwn: boolean;
}

function formatTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  return date.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

export function ChatMessageItem({ message, isOwn }: ChatMessageProps) {
  // System message
  if (message.type === "system") {
    return (
      <div className="flex justify-center py-1">
        <span className="font-mono text-xs text-[#4DAFFF]/70 px-3 py-1 rounded-full bg-[#4DAFFF]/5 border border-[#4DAFFF]/10">
          {message.text}
        </span>
      </div>
    );
  }

  // Deleted message
  if (message.deleted) {
    return (
      <div className={`flex ${isOwn ? "justify-end" : "justify-start"} py-0.5`}>
        <div className="max-w-[80%] px-3 py-1.5 rounded-lg bg-white/[0.02] border border-border/20">
          <span className="font-mono text-xs text-muted-foreground/50 italic">
            [삭제된 메시지]
          </span>
        </div>
      </div>
    );
  }

  const roleBadge = message.senderRole === "judge" ? (
    <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 font-mono text-[9px] px-1 py-0 leading-tight">
      J
    </Badge>
  ) : message.senderRole === "admin" ? (
    <Badge className="bg-red-500/20 text-red-400 border-red-500/30 font-mono text-[9px] px-1 py-0 leading-tight">
      A
    </Badge>
  ) : null;

  return (
    <div className={`flex ${isOwn ? "justify-end" : "justify-start"} py-0.5 group`}>
      <div className={`max-w-[80%] ${isOwn ? "items-end" : "items-start"}`}>
        {/* Sender info - only show for others */}
        {!isOwn && (
          <div className="flex items-center gap-1.5 mb-0.5 px-1">
            <span className="font-mono text-[11px] font-medium text-primary/80">
              {message.senderName}
            </span>
            {message.senderTeamName && (
              <span className="font-mono text-[10px] text-[#4DAFFF]/60">
                [{message.senderTeamName}]
              </span>
            )}
            {roleBadge}
          </div>
        )}
        {/* Message bubble */}
        <div
          className={`px-3 py-1.5 rounded-lg font-mono text-[13px] leading-relaxed break-words whitespace-pre-wrap ${
            isOwn
              ? "bg-primary/15 border border-primary/20 text-foreground"
              : "bg-white/[0.04] border border-border/30 text-foreground/90"
          }`}
        >
          {message.text}
        </div>
        {/* Timestamp */}
        <div className={`px-1 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity ${isOwn ? "text-right" : "text-left"}`}>
          <span className="font-mono text-[9px] text-muted-foreground/50">
            {formatTime(message.createdAt)}
          </span>
        </div>
      </div>
    </div>
  );
}
