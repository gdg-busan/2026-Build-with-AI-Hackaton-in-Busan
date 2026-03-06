"use client";

import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/shared/ui/dialog";
import type { Team } from "@/shared/types";

interface VoteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedTeams: Team[];
  onConfirm: () => void;
  loading?: boolean;
}

export function VoteConfirmDialog({
  open,
  onOpenChange,
  selectedTeams,
  onConfirm,
  loading = false,
}: VoteConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)}>
        <DialogHeader>
          <DialogTitle className="font-mono glow-green">
            $ confirm_vote
          </DialogTitle>
          <DialogDescription>
            다음 팀들에게 투표합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#FF6B35]/10 border border-[#FF6B35]/30">
          <span className="text-[#FF6B35] text-sm shrink-0">⚠️</span>
          <span className="font-mono text-xs text-[#FF6B35]">
            투표 후에는 변경할 수 없습니다. 신중하게 선택해주세요!
          </span>
        </div>

        <div className="space-y-2 my-4">
          {selectedTeams.map((team) => (
            <div
              key={team.id}
              className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 border border-border"
            >
              <span className="text-2xl">{team.emoji}</span>
              <span className="font-mono font-medium">{team.name}</span>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            취소
          </Button>
          <Button onClick={onConfirm} disabled={loading}>
            {loading ? (
              <span className="font-mono">투표 처리중...</span>
            ) : (
              <span className="font-mono">
                투표하기 ({selectedTeams.length}팀)
              </span>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
