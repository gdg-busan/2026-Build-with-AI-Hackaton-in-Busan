"use client";

import { motion } from "framer-motion";
import { Check, Ban, Info, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Team } from "@/lib/types";

interface TeamCardProps {
  team: Team;
  isSelected: boolean;
  isOwnTeam: boolean;
  onToggle: (teamId: string) => void;
  onInspect?: (team: Team) => void;
  disabled?: boolean;
}

export function TeamCard({
  team,
  isSelected,
  isOwnTeam,
  onToggle,
  onInspect,
  disabled = false,
}: TeamCardProps) {
  const isDisabled = disabled || isOwnTeam;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={!isDisabled ? { scale: 1.02 } : undefined}
      whileTap={!isDisabled ? { scale: 0.98 } : undefined}
      onClick={() => !isDisabled && onToggle(team.id)}
      className={cn(
        "relative rounded-xl border p-5 cursor-pointer transition-all duration-300",
        isSelected
          ? "border-primary/60 bg-primary/5 card-glow-selected"
          : "border-border bg-card card-glow hover:border-primary/30",
        isOwnTeam && "border-[#4DAFFF]/40 bg-[#4DAFFF]/5 cursor-default",
        disabled && !isOwnTeam && "cursor-not-allowed"
      )}
    >
      {/* Selection indicator */}
      {isSelected && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute -top-2 -right-2 w-7 h-7 bg-primary rounded-full flex items-center justify-center shadow-lg"
        >
          <Check className="w-4 h-4 text-primary-foreground" />
        </motion.div>
      )}

      {/* Own team indicator */}
      {isOwnTeam && !isSelected && (
        <div className="absolute -top-2 -right-2 px-2 h-6 bg-[#4DAFFF] rounded-full flex items-center justify-center gap-1 shadow-lg shadow-[#4DAFFF]/20">
          <Star className="w-3 h-3 text-white fill-white" />
          <span className="font-mono text-[10px] font-bold text-white">MY TEAM</span>
        </div>
      )}

      {/* Inspect button */}
      {onInspect && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onInspect(team);
          }}
          className="absolute top-2.5 left-2.5 w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-[#4DAFFF] hover:bg-[#4DAFFF]/10 transition-colors z-10"
          aria-label="팀 상세 보기"
        >
          <Info className="w-4 h-4" />
        </button>
      )}

      {/* Team emoji */}
      <div className="text-4xl mb-3">{team.emoji}</div>

      {/* Team name with optional nickname */}
      <h3
        className={cn(
          "font-mono font-bold text-lg mb-1",
          isSelected ? "text-primary glow-green" : "text-foreground"
        )}
      >
        {team.name}
        {team.nickname && (
          <span className="text-muted-foreground font-normal text-sm ml-1">
            ({team.nickname})
          </span>
        )}
      </h3>

      {/* Team description */}
      <p className="text-sm text-muted-foreground line-clamp-2">
        {team.description}
      </p>

      {/* Detail hint */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onInspect?.(team);
        }}
        className="mt-3 inline-flex items-center gap-1.5 text-xs font-mono text-[#4DAFFF] hover:text-[#4DAFFF]/80 transition-colors"
      >
        <Info className="w-3 h-3" />
        상세 보기
      </button>

      {/* Own team label */}
      {isOwnTeam && (
        <div className="mt-2 text-xs font-mono text-[#4DAFFF]">
          // 내 팀 — 다른 팀에 투표해주세요
        </div>
      )}
    </motion.div>
  );
}
