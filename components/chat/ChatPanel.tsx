"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { MessageCircle, X } from "lucide-react";
import { getFirebaseAuth } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { useChatRoom, useUnreadCounts, markAsRead } from "@/hooks/useChatRoom";
import { MessageList } from "./MessageList";
import { ChatComposer } from "./ChatComposer";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

type ChatTab = "global" | "team";

export function ChatPanel() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<ChatTab>("global");
  const [roomsReady, setRoomsReady] = useState(false);
  const initCalledRef = useRef(false);

  // Auto-initialize chat rooms on mount
  useEffect(() => {
    if (!user || initCalledRef.current) return;
    initCalledRef.current = true;

    const initRooms = async () => {
      try {
        const token = await getFirebaseAuth().currentUser?.getIdToken();
        if (!token) return;
        await fetch("/api/chat/rooms", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setRoomsReady(true);
      } catch {
        // Silent fail — rooms may already exist
        setRoomsReady(true);
      }
    };
    initRooms();
  }, [user]);

  const globalRoomId = "global";
  const teamRoomId = user?.teamId || null;
  const currentRoomId = activeTab === "global" ? globalRoomId : teamRoomId;

  const { messages, loading, hasMore, loadMore, error } = useChatRoom(
    roomsReady ? currentRoomId : null
  );

  // Track unread for both rooms
  const roomIds = teamRoomId ? [globalRoomId, teamRoomId] : [globalRoomId];
  const { unreadMap } = useUnreadCounts(user?.uniqueCode || null, roomIds);

  const hasAnyUnread = Object.values(unreadMap).some(Boolean);

  // Mark as read when opening or switching tabs
  const handleOpen = useCallback(
    (isOpen: boolean) => {
      setOpen(isOpen);
      if (isOpen && user && currentRoomId) {
        markAsRead(user.uniqueCode, currentRoomId);
      }
    },
    [user, currentRoomId]
  );

  const handleTabSwitch = useCallback(
    (tab: ChatTab) => {
      setActiveTab(tab);
      const roomId = tab === "global" ? globalRoomId : teamRoomId;
      if (user && roomId) {
        markAsRead(user.uniqueCode, roomId);
      }
    },
    [user, teamRoomId]
  );

  const handleSend = useCallback(
    async (text: string) => {
      if (!user || !currentRoomId) return;
      try {
        const token = await getFirebaseAuth().currentUser?.getIdToken();
        if (!token) throw new Error("인증 토큰을 가져올 수 없습니다");

        const res = await fetch("/api/chat/send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ roomId: currentRoomId, text }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "메시지 전송에 실패했습니다");

        // Mark as read after sending
        markAsRead(user.uniqueCode, currentRoomId);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "메시지 전송에 실패했습니다"
        );
        throw err;
      }
    },
    [user, currentRoomId]
  );

  if (!user) return null;

  return (
    <>
      {/* Floating chat button */}
      <button
        onClick={() => handleOpen(true)}
        className="fixed bottom-6 right-6 z-30 w-12 h-12 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center hover:bg-primary/30 transition-all hover:scale-105 shadow-lg shadow-primary/10 group"
      >
        <MessageCircle className="w-5 h-5 text-primary group-hover:text-primary" />
        {hasAnyUnread && (
          <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#FF6B35] border-2 border-[#0A0E1A] animate-pulse" />
        )}
      </button>

      {/* Chat Sheet */}
      <Sheet open={open} onOpenChange={handleOpen}>
        <SheetContent
          side="right"
          showCloseButton={false}
          className="bg-[#0D1220] border-l-2 border-primary/30 w-full sm:max-w-[380px] p-0 flex flex-col"
        >
          {/* Scanline overlay */}
          <div className="absolute inset-0 scanline pointer-events-none z-10 opacity-30" />

          {/* Header */}
          <SheetHeader className="p-0 relative z-20 flex-shrink-0">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-primary" />
                <SheetTitle className="font-mono text-sm font-bold text-foreground">
                  $ chat
                </SheetTitle>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <SheetDescription className="sr-only">실시간 채팅</SheetDescription>

            {/* Tab bar */}
            <div className="flex border-b border-border/20 px-2 relative z-20">
              <button
                onClick={() => handleTabSwitch("global")}
                className={`flex-1 py-2 font-mono text-xs text-center transition-colors relative ${
                  activeTab === "global"
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground/70"
                }`}
              >
                [GLOBAL]
                {unreadMap[globalRoomId] && activeTab !== "global" && (
                  <span className="absolute top-1.5 right-4 w-1.5 h-1.5 rounded-full bg-[#FF6B35]" />
                )}
                {activeTab === "global" && (
                  <div className="absolute bottom-0 left-2 right-2 h-[2px] bg-primary rounded-full shadow-[0_0_6px_rgba(0,255,136,0.5)]" />
                )}
              </button>
              {teamRoomId && (
                <button
                  onClick={() => handleTabSwitch("team")}
                  className={`flex-1 py-2 font-mono text-xs text-center transition-colors relative ${
                    activeTab === "team"
                      ? "text-[#4DAFFF]"
                      : "text-muted-foreground hover:text-foreground/70"
                  }`}
                >
                  [TEAM]
                  {unreadMap[teamRoomId] && activeTab !== "team" && (
                    <span className="absolute top-1.5 right-4 w-1.5 h-1.5 rounded-full bg-[#FF6B35]" />
                  )}
                  {activeTab === "team" && (
                    <div className="absolute bottom-0 left-2 right-2 h-[2px] bg-[#4DAFFF] rounded-full shadow-[0_0_6px_rgba(77,175,255,0.5)]" />
                  )}
                </button>
              )}
            </div>
          </SheetHeader>

          {/* Messages area */}
          <div className="flex-1 flex flex-col min-h-0 relative z-20">
            {error && (
              <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/20 flex-shrink-0">
                <p className="font-mono text-xs text-red-400">
                  {">"} {error}
                </p>
              </div>
            )}
            <MessageList
              messages={messages}
              currentUserId={user.uid}
              loading={loading}
              hasMore={hasMore}
              onLoadMore={loadMore}
            />
            <ChatComposer
              onSend={handleSend}
              disabled={!currentRoomId}
              placeholder={
                activeTab === "global"
                  ? "전체 채팅에 메시지를 입력하세요..."
                  : "팀 채팅에 메시지를 입력하세요..."
              }
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
