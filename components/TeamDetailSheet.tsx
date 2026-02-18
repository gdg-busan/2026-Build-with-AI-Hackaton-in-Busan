"use client";

import { motion } from "framer-motion";
import { ExternalLink, Users, Check, Ban, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import type { Team, MemberProfile } from "@/lib/types";

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
}: TeamDetailSheetProps) {
  if (!team) return null;

  const voteDisabled = !canVote || isOwnTeam || (!isSelected && maxReached);

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
              <span className="text-primary/60">//</span> description
            </div>
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
              {team.description || "설명이 없습니다."}
            </p>
          </div>

          {/* Members */}
          <div className="space-y-2">
            <div className="font-mono text-xs text-muted-foreground">
              <span className="text-primary/60">//</span> members [{team.memberUserIds.length}]
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
                    <div className="min-w-0">
                      <p className="font-mono text-sm font-medium text-foreground">
                        {member.name}
                      </p>
                      {member.bio && (
                        <p className="text-xs text-muted-foreground mt-0.5 break-words">
                          {member.bio}
                        </p>
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
                <span className="text-primary/60">//</span> project
              </div>
              <a
                href={team.projectUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-3 rounded-lg border border-[#4DAFFF]/20 bg-[#4DAFFF]/5 hover:bg-[#4DAFFF]/10 transition-colors group"
              >
                <ExternalLink className="w-4 h-4 text-[#4DAFFF] group-hover:text-[#4DAFFF]" />
                <span className="font-mono text-sm text-[#4DAFFF] truncate">
                  {team.projectUrl}
                </span>
              </a>
            </div>
          )}

          {/* Divider */}
          <div className="border-t border-border/50 pt-4" />

          {/* Vote action */}
          <div className="space-y-2">
            <div className="font-mono text-xs text-muted-foreground">
              <span className="text-primary/60">//</span> action
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
