"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import type { Team } from "@/lib/types";

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
            다음 팀들에게 투표합니다. 투표 후 변경할 수 없습니다.
          </DialogDescription>
        </DialogHeader>

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
