"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { getFirebaseAuth } from "@/lib/firebase";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface MemberProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentName: string;
  currentBio: string | null;
}

export function MemberProfileDialog({
  open,
  onOpenChange,
  currentName,
  currentBio,
}: MemberProfileDialogProps) {
  const [name, setName] = useState(currentName);
  const [bio, setBio] = useState(currentBio ?? "");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setName(currentName);
      setBio(currentBio ?? "");
    }
  }, [open, currentName, currentBio]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const token = await getFirebaseAuth().currentUser?.getIdToken();
      if (!token) throw new Error("인증 토큰을 가져올 수 없습니다");

      const res = await fetch("/api/user", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: name.trim(), bio: bio.trim() || null }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "프로필 수정에 실패했습니다");

      toast.success("프로필이 저장되었습니다!");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "프로필 수정에 실패했습니다");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border font-mono max-w-md">
        <DialogHeader>
          <DialogTitle className="text-primary glow-green font-mono text-lg">
            $ 프로필 수정
          </DialogTitle>
          <DialogDescription className="font-mono text-muted-foreground text-xs">
            한 줄 소개를 입력하세요
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono text-muted-foreground">
              이름
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                if (e.target.value.length <= 20) {
                  setName(e.target.value);
                }
              }}
              maxLength={20}
              placeholder="이름을 입력하세요"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/60 transition-colors"
            />
            <p className="text-xs text-muted-foreground/60 text-right">
              {name.length}/20
            </p>
          </div>

          {/* Bio */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono text-muted-foreground">
              소개
            </label>
            <textarea
              value={bio}
              onChange={(e) => {
                if (e.target.value.length <= 100) {
                  setBio(e.target.value);
                }
              }}
              rows={3}
              maxLength={100}
              placeholder="나를 소개해주세요 (예: AI 개발 3년차, 풀스택 개발자)"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/60 resize-none transition-colors"
            />
            <p className="text-xs text-muted-foreground/60 text-right">
              {bio.length}/100
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
