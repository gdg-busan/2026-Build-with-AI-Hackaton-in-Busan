"use client";

import { motion } from "framer-motion";
import { Users } from "lucide-react";
import { Progress } from "@/shared/ui/progress";

interface VotingProgressProps {
  votedCount: number;
  totalCount: number;
}

export function VotingProgress({ votedCount, totalCount }: VotingProgressProps) {
  const percentage = totalCount > 0 ? (votedCount / totalCount) * 100 : 0;

  return (
    <div className="flex items-center gap-4 p-4 rounded-xl bg-card border border-border">
      <Users className="w-5 h-5 text-primary shrink-0" />
      <div className="flex-1">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground font-mono">
            투표 현황
          </span>
          <motion.span
            key={votedCount}
            initial={{ scale: 1.3, color: "#00FF88" }}
            animate={{ scale: 1, color: "#E8F4FD" }}
            className="text-sm font-mono font-bold"
          >
            {votedCount}/{totalCount}명 완료
          </motion.span>
        </div>
        <Progress value={percentage} />
      </div>
    </div>
  );
}
