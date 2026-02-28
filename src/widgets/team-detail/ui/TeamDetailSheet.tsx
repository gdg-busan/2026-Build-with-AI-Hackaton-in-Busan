"use client";

import { useEffect, useState } from "react";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { getFirebaseDb } from "@/shared/api/firebase";
import { EVENT_ID } from "@/shared/config/constants";
import { motion } from "framer-motion";
import { ExternalLink, Users, Check, Ban, X, Github, Monitor } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/shared/ui/sheet";
import type { Team, MemberProfile } from "@/shared/types";
import { FeedbackBoard } from "@/features/feedback/ui/FeedbackBoard";
import { gaExternalLinkClick } from "@/shared/lib/gtag";

interface CheerEntry {
  id: string;
  emoji: string;
  userName: string;
  createdAt: Date;
}

interface TeamDetailSheetProps {
  team: Team | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isSelected: boolean;
  isOwnTeam: boolean;
  canVote: boolean;
  maxReached: boolean;
  onToggleVote: (teamId: string) => void;
  members?: MemberProfile[];
  isTeamMember?: boolean;
}

export function TeamDetailSheet({
  team,
  open,
  onOpenChange,
  isSelected,
  isOwnTeam,
  canVote,
  maxReached,
  onToggleVote,
  members = [],
  isTeamMember = false,
}: TeamDetailSheetProps) {
  const [cheers, setCheers] = useState<CheerEntry[]>([]);

  // Subscribe to recent cheers
  useEffect(() => {
    if (!team) return;
    const cheersRef = collection(
      getFirebaseDb(),
      "events",
      EVENT_ID,
      "teams",
      team.id,
      "cheers"
    );
    const q = query(cheersRef, orderBy("createdAt", "desc"), limit(20));
    const unsub = onSnapshot(q, (snap) => {
      setCheers(
        snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            emoji: data.emoji,
            userName: data.userName ?? "익명",
            createdAt: data.createdAt?.toDate?.() ?? new Date(),
          };
        })
      );
    });
    return () => {
      unsub();
      setCheers([]);
    };
  }, [team]);

  if (!team) return null;

  const voteDisabled = !canVote || isOwnTeam || (!isSelected && maxReached);

  const hasShowcase =
    team.demoUrl ||
    team.githubUrl ||
    (team.techStack && team.techStack.length > 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="bg-[#0D1220] border-l-2 border-primary/40 drawer-glow w-full sm:max-w-md overflow-y-auto p-0"
      >
        {/* Scanline overlay */}
        <div className="absolute inset-0 scanline pointer-events-none z-10" />

        {/* Close button */}
        <button
          onClick={() => onOpenChange(false)}
          className="absolute top-4 right-4 z-20 w-8 h-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <SheetHeader className="p-6 pb-4 relative z-10">
          <div className="font-mono text-xs text-muted-foreground mb-3">
            <span className="text-primary glow-green">$</span> inspect --team=&quot;{team.name}&quot;
            <span className="typing-cursor" />
          </div>

          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="text-5xl mb-2"
          >
            {team.emoji}
          </motion.div>

          <SheetTitle className="font-mono font-bold text-xl text-foreground">
            {team.name}
            {team.nickname && (
              <span className="text-muted-foreground font-normal text-sm ml-2">
                ({team.nickname})
              </span>
            )}
          </SheetTitle>
          <SheetDescription className="sr-only">
            {team.name} 팀 상세 정보
          </SheetDescription>
        </SheetHeader>

        {/* Content */}
        <div className="px-6 pb-6 space-y-5 relative z-10">
          {/* Description */}
          <div className="space-y-2">
            <div className="font-mono text-xs text-muted-foreground">
              <span className="text-primary/60">{"// description"}</span>
            </div>
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
              {team.description || "설명이 없습니다."}
            </p>
          </div>

          {/* Members */}
          <div className="space-y-2">
            <div className="font-mono text-xs text-muted-foreground">
              <span className="text-primary/60">{"// members"}</span> [{team.memberUserIds.length}]
            </div>
            <div className="space-y-2">
              {members.length > 0 ? (
                members.map((member) => (
                  <div
                    key={member.uniqueCode}
                    className="flex items-start gap-3 px-3 py-2.5 rounded-lg border border-border/50 bg-background/50"
                  >
                    <div className="w-8 h-8 rounded-full bg-[#4DAFFF]/10 border border-[#4DAFFF]/20 flex items-center justify-center flex-shrink-0">
                      <Users className="w-4 h-4 text-[#4DAFFF]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-sm font-medium text-foreground">
                        {member.name}
                      </p>
                      {member.bio && (
                        <p className="text-xs text-muted-foreground mt-0.5 break-words">
                          {member.bio}
                        </p>
                      )}
                      {member.techTags && member.techTags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {member.techTags.map((tag) => (
                            <span
                              key={tag}
                              className="px-1.5 py-0.5 rounded border border-primary/20 bg-primary/5 font-mono text-[10px] text-primary/80"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="w-4 h-4 text-[#4DAFFF]" />
                  <span className="font-mono">[{team.memberUserIds.length}] 팀원</span>
                </div>
              )}
            </div>
          </div>

          {/* Project URL */}
          {team.projectUrl && (
            <div className="space-y-2">
              <div className="font-mono text-xs text-muted-foreground">
                <span className="text-primary/60">{"// project"}</span>
              </div>
              <a
                href={team.projectUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => gaExternalLinkClick("project", team.id)}
                className="flex items-center gap-2 px-4 py-3 rounded-lg border border-[#4DAFFF]/20 bg-[#4DAFFF]/5 hover:bg-[#4DAFFF]/10 transition-colors group"
              >
                <ExternalLink className="w-4 h-4 text-[#4DAFFF] group-hover:text-[#4DAFFF]" />
                <span className="font-mono text-sm text-[#4DAFFF] truncate">
                  {team.projectUrl}
                </span>
              </a>
            </div>
          )}

          {/* Showcase section */}
          {hasShowcase && (
            <div className="space-y-3">
              <div className="font-mono text-xs text-muted-foreground">
                <span className="text-primary/60">{"// showcase"}</span>
              </div>

              {/* Tech stack tags */}
              {team.techStack && team.techStack.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {team.techStack.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 rounded border border-[#00FF88]/20 bg-[#00FF88]/5 font-mono text-xs text-[#00FF88]/80"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Quick-link buttons */}
              <div className="flex flex-wrap gap-2">
                {team.demoUrl && (
                  <a
                    href={team.demoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => gaExternalLinkClick("demo", team.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[#FF6B35]/20 bg-[#FF6B35]/5 hover:bg-[#FF6B35]/10 transition-colors group"
                  >
                    <Monitor className="w-3.5 h-3.5 text-[#FF6B35]" />
                    <span className="font-mono text-xs text-[#FF6B35]">Demo</span>
                    <ExternalLink className="w-3 h-3 text-[#FF6B35]/60" />
                  </a>
                )}
                {team.githubUrl && (
                  <a
                    href={team.githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => gaExternalLinkClick("github", team.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border/40 bg-background/50 hover:bg-white/5 transition-colors group"
                  >
                    <Github className="w-3.5 h-3.5 text-foreground/70" />
                    <span className="font-mono text-xs text-foreground/70">GitHub</span>
                    <ExternalLink className="w-3 h-3 text-muted-foreground/50" />
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Divider */}
          <div className="border-t border-border/50 pt-4" />

          {/* Vote action */}
          <div className="space-y-2">
            <div className="font-mono text-xs text-muted-foreground">
              <span className="text-primary/60">{"// action"}</span>
            </div>

            {isOwnTeam ? (
              <div className="flex items-center gap-2 px-4 py-3 rounded-lg border border-destructive/20 bg-destructive/5">
                <Ban className="w-4 h-4 text-destructive" />
                <span className="font-mono text-sm text-destructive">
                  자기 팀에는 투표할 수 없습니다
                </span>
              </div>
            ) : (
              <Button
                onClick={() => {
                  onToggleVote(team.id);
                }}
                disabled={voteDisabled}
                className={cn(
                  "w-full font-mono gap-2 h-12 text-base",
                  isSelected
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "bg-card border border-primary/30 text-primary hover:bg-primary/10"
                )}
              >
                {isSelected ? (
                  <>
                    <Check className="w-5 h-5" />$ selected
                  </>
                ) : (
                  <>$ vote_for_team</>
                )}
              </Button>
            )}
          </div>

          {/* Cheers section */}
          {cheers.length > 0 && (
            <div className="space-y-3">
              <div className="font-mono text-xs text-muted-foreground">
                <span className="text-primary/60">{"// cheers"}</span> [{cheers.length}]
              </div>
              <div className="flex flex-wrap gap-1.5">
                {cheers.map((cheer) => (
                  <div
                    key={cheer.id}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-full border border-border/50 bg-background/50"
                    title={`${cheer.userName} · ${cheer.createdAt.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}`}
                  >
                    <span className="text-sm">{cheer.emoji}</span>
                    <span className="font-mono text-[10px] text-muted-foreground truncate max-w-[60px]">
                      {cheer.userName}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Feedback section */}
          <div className="space-y-3">
            <div className="font-mono text-xs text-muted-foreground">
              <span className="text-primary/60">{"// feedback"}</span>
            </div>
            <FeedbackBoard teamId={team.id} isTeamMember={isTeamMember} />
          </div>
        </div>

        {/* Bottom hint */}
        <div className="mt-auto px-6 py-4 border-t border-border/30 relative z-10">
          <p className="font-mono text-xs text-muted-foreground text-center">
            <span className="text-primary/60">[ESC]</span> 닫기
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
