"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { getFirebaseAuth } from "@/lib/firebase";
import type { Team } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface TeamEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  team: Team;
}

export function TeamEditDialog({ open, onOpenChange, team }: TeamEditDialogProps) {
  const [nickname, setNickname] = useState(team.nickname ?? "");
  const [description, setDescription] = useState(team.description);
  const [projectUrl, setProjectUrl] = useState(team.projectUrl ?? "");
  const [submitting, setSubmitting] = useState(false);

  // Sync form state when team prop changes
  useEffect(() => {
    setNickname(team.nickname ?? "");
    setDescription(team.description);
    setProjectUrl(team.projectUrl ?? "");
  }, [team]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const token = await getFirebaseAuth().currentUser?.getIdToken();
      if (!token) throw new Error("인증 토큰을 가져올 수 없습니다");

      const res = await fetch("/api/team", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          nickname: nickname.trim() || null,
          description: description.trim(),
          projectUrl: projectUrl.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "팀 정보 수정에 실패했습니다");

      toast.success("팀 정보가 수정되었습니다!");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "팀 정보 수정에 실패했습니다");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border font-mono max-w-md">
        <DialogHeader>
          <DialogTitle className="text-primary glow-green font-mono text-lg">
            $ 팀 정보 수정
          </DialogTitle>
          <DialogDescription className="text-muted-foreground font-mono text-xs">
            팀명: <span className="text-foreground">{team.name}</span>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Nickname */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono text-muted-foreground">
              팀 별칭
            </label>
            <Input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={30}
              placeholder="별칭을 입력하세요 (예: 우리팀 화이팅)"
              className="font-mono bg-background border-border focus:border-primary/60 text-foreground"
            />
            <p className="text-xs text-muted-foreground/60 text-right">
              {nickname.length}/30
            </p>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono text-muted-foreground">
              팀 소개
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="팀 소개를 입력하세요"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/60 resize-none transition-colors"
            />
          </div>

          {/* Project URL */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono text-muted-foreground">
              프로젝트 URL
            </label>
            <Input
              type="url"
              value={projectUrl}
              onChange={(e) => setProjectUrl(e.target.value)}
              placeholder="https://..."
              className="font-mono bg-background border-border focus:border-primary/60 text-foreground"
            />
            <p className="text-xs font-mono text-muted-foreground/60">
              // 결과물 링크 (GitHub, 데모 사이트 등)
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
              className="flex-1 font-mono border border-border"
            >
              취소
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="flex-1 font-mono"
            >
              {submitting ? "$ saving..." : "$ 저장"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
