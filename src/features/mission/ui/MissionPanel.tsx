"use client";

import { useState, useEffect } from "react";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { getFirebaseDb } from "@/shared/api/firebase";
import { EVENT_ID } from "@/shared/config/constants";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/shared/ui/sheet";
import { useAuth } from "@/features/auth/model/auth-context";
import { useMissions } from "@/features/mission/model/useMissions";
import { gaMissionPanelOpen } from "@/shared/lib/gtag";
import { MISSIONS } from "@/features/mission/model/missions";

export function MissionPanel() {
  const { user } = useAuth();
  const { missions, completedCount, totalCount } = useMissions(
    user?.uniqueCode
  );
  const [open, setOpen] = useState(false);
  const [teamCount, setTeamCount] = useState(0);
  const [allCompletedAt, setAllCompletedAt] = useState<Date | null>(null);

  // Fetch team count for dynamic mission targets
  useEffect(() => {
    const teamsRef = collection(getFirebaseDb(), "events", EVENT_ID, "teams");
    const unsub = onSnapshot(teamsRef, (snap) => {
      setTeamCount(snap.size);
    });
    return () => unsub();
  }, []);

  // Subscribe to user doc for allMissionsCompletedAt
  useEffect(() => {
    if (!user?.uniqueCode) return;
    const userRef = doc(getFirebaseDb(), "events", EVENT_ID, "users", user.uniqueCode);
    const unsub = onSnapshot(userRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setAllCompletedAt(data.allMissionsCompletedAt?.toDate?.() ?? null);
      }
    });
    return () => unsub();
  }, [user?.uniqueCode]);

  return (
    <>
      {/* Floating trophy button - bottom LEFT */}
      <button
        onClick={() => { gaMissionPanelOpen(); setOpen(true); }}
        className="fixed bottom-6 left-6 z-50 w-14 h-14 rounded-full bg-card border border-primary/40 shadow-lg flex items-center justify-center hover:border-primary transition-colors hover:shadow-[0_0_16px_rgba(0,255,136,0.3)] group"
        aria-label="미션 보기"
      >
        <span className="text-xl">🏆</span>
        {completedCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[20px] h-5 rounded-full bg-primary text-background text-[10px] font-mono font-bold flex items-center justify-center px-1 shadow-[0_0_8px_rgba(0,255,136,0.6)]">
            {completedCount}/{totalCount}
          </span>
        )}
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="left"
          className="w-80 sm:w-96 bg-card border-r border-primary/30 font-mono p-0 flex flex-col"
        >
          {/* Scanline overlay */}
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.03] z-0"
            style={{
              backgroundImage:
                "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,136,0.5) 2px, rgba(0,255,136,0.5) 3px)",
            }}
          />

          <SheetHeader className="px-5 pt-5 pb-4 border-b border-primary/20">
            <SheetTitle className="font-mono text-primary text-base flex items-center gap-2">
              <span className="text-lg">🏆</span>
              <span className="glow-green">$ missions</span>
            </SheetTitle>
            <div className="flex items-center gap-2 mt-1">
              <div className="flex-1 h-1.5 rounded-full bg-background overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(0,255,136,0.6)]"
                  style={{
                    width:
                      totalCount > 0
                        ? `${(completedCount / totalCount) * 100}%`
                        : "0%",
                  }}
                />
              </div>
              <span className="text-xs text-muted-foreground font-mono">
                {completedCount}/{totalCount}
              </span>
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {MISSIONS.map((mission) => {
              const progress = missions.find(
                (m) => m.missionId === mission.id
              );
              const current = progress?.current ?? 0;
              const completed = progress?.completed ?? false;
              const resolvedTarget = mission.target > 0 ? mission.target : teamCount;
              const pct = Math.min(
                100,
                resolvedTarget > 0 ? (current / resolvedTarget) * 100 : 0
              );

              return (
                <div
                  key={mission.id}
                  className={`rounded-lg border p-3 transition-all ${
                    completed
                      ? "border-primary/50 bg-primary/5 shadow-[0_0_12px_rgba(0,255,136,0.15)]"
                      : "border-border bg-background/50"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-lg leading-none mt-0.5">
                      {mission.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`text-sm font-mono font-bold truncate ${
                            completed ? "text-primary" : "text-foreground"
                          }`}
                        >
                          {mission.title}
                        </span>
                        {completed ? (
                          <span className="text-primary text-xs shrink-0 glow-green">
                            ✓ done
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs font-mono shrink-0">
                            {current}/{resolvedTarget}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {mission.description}
                      </p>
                      {/* Progress bar */}
                      <div className="mt-2 h-1 rounded-full bg-background overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            completed
                              ? "bg-primary shadow-[0_0_6px_rgba(0,255,136,0.6)]"
                              : "bg-muted-foreground/40"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="px-5 py-3 border-t border-primary/20">
            {completedCount === totalCount && totalCount > 0 && allCompletedAt ? (
              <p className="text-xs text-primary font-mono text-center glow-green">
                {"🎉 모든 미션 완료! ("}
                {allCompletedAt.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                {")"}
              </p>
            ) : (
              <p className="text-[10px] text-muted-foreground/60 font-mono text-center">
                {"// 미션을 완료하고 배지를 획득하세요"}
              </p>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
