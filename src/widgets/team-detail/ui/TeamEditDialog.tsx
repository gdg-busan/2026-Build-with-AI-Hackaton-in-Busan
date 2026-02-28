"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { X } from "lucide-react";
import { getFirebaseAuth } from "@/shared/api/firebase";
import type { Team } from "@/shared/types";
import { gaTeamEdit } from "@/shared/lib/gtag";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";

const PRESET_TECH_TAGS = [
  "React", "Next.js", "TypeScript", "JavaScript", "Python",
  "Firebase", "Node.js", "Flutter", "AI/ML", "FastAPI",
  "PostgreSQL", "MongoDB", "Docker", "Tailwind CSS", "Vue.js",
];

interface TeamEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  team: Team;
}

export function TeamEditDialog({ open, onOpenChange, team }: TeamEditDialogProps) {
  const [nickname, setNickname] = useState(team.nickname ?? "");
  const [description, setDescription] = useState(team.description);
  const [projectUrl, setProjectUrl] = useState(team.projectUrl ?? "");
  const [demoUrl, setDemoUrl] = useState(team.demoUrl ?? "");
  const [githubUrl, setGithubUrl] = useState(team.githubUrl ?? "");
  const [techStack, setTechStack] = useState<string[]>(team.techStack ?? []);
  const [customTag, setCustomTag] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Sync form state when team prop changes
  useEffect(() => {
    setNickname(team.nickname ?? "");
    setDescription(team.description);
    setProjectUrl(team.projectUrl ?? "");
    setDemoUrl(team.demoUrl ?? "");
    setGithubUrl(team.githubUrl ?? "");
    setTechStack(team.techStack ?? []);
  }, [team]);

  const toggleTag = (tag: string) => {
    setTechStack((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const addCustomTag = () => {
    const trimmed = customTag.trim();
    if (!trimmed || techStack.includes(trimmed)) return;
    setTechStack((prev) => [...prev, trimmed]);
    setCustomTag("");
  };

  const removeTag = (tag: string) => {
    setTechStack((prev) => prev.filter((t) => t !== tag));
  };

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
          demoUrl: demoUrl.trim() || null,
          githubUrl: githubUrl.trim() || null,
          techStack,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "팀 정보 수정에 실패했습니다");

      gaTeamEdit();
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
      <DialogContent className="bg-card border-border font-mono max-w-lg max-h-[90vh] overflow-y-auto">
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
              {"// 결과물 링크 (GitHub, 데모 사이트 등)"}
            </p>
          </div>

          {/* Showcase section divider */}
          <div className="border-t border-border/40 pt-2">
            <p className="font-mono text-xs text-primary/60 mb-3">{"// showcase links"}</p>

            {/* Demo URL */}
            <div className="space-y-1.5 mb-3">
              <label className="text-xs font-mono text-muted-foreground">
                🔗 Demo URL
              </label>
              <Input
                type="url"
                value={demoUrl}
                onChange={(e) => setDemoUrl(e.target.value)}
                placeholder="https://your-demo.vercel.app"
                className="font-mono bg-background border-border focus:border-[#FF6B35]/60 text-foreground"
              />
            </div>

            {/* GitHub URL */}
            <div className="space-y-1.5 mb-3">
              <label className="text-xs font-mono text-muted-foreground">
                💻 GitHub URL
              </label>
              <Input
                type="url"
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
                placeholder="https://github.com/your-org/repo"
                className="font-mono bg-background border-border focus:border-border text-foreground"
              />
            </div>

          </div>

          {/* Tech Stack */}
          <div className="space-y-2">
            <p className="font-mono text-xs text-primary/60">{"// tech stack"}</p>

            {/* Preset tags */}
            <div className="flex flex-wrap gap-1.5">
              {PRESET_TECH_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`px-2 py-0.5 rounded border font-mono text-xs transition-colors ${
                    techStack.includes(tag)
                      ? "border-[#00FF88]/60 bg-[#00FF88]/10 text-[#00FF88]"
                      : "border-border/40 bg-background/50 text-muted-foreground hover:border-border hover:text-foreground"
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>

            {/* Custom tag input */}
            <div className="flex gap-2">
              <Input
                value={customTag}
                onChange={(e) => setCustomTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCustomTag();
                  }
                }}
                placeholder="직접 입력 (Enter)"
                maxLength={20}
                className="font-mono bg-background border-border focus:border-primary/60 text-foreground text-xs h-8"
              />
              <Button
                type="button"
                onClick={addCustomTag}
                variant="ghost"
                className="h-8 px-3 font-mono text-xs border border-border"
              >
                추가
              </Button>
            </div>

            {/* Selected custom tags (non-preset) */}
            {techStack.filter((t) => !PRESET_TECH_TAGS.includes(t)).length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {techStack
                  .filter((t) => !PRESET_TECH_TAGS.includes(t))
                  .map((tag) => (
                    <span
                      key={tag}
                      className="flex items-center gap-1 px-2 py-0.5 rounded border border-[#00FF88]/40 bg-[#00FF88]/5 font-mono text-xs text-[#00FF88]/80"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="hover:text-destructive transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
              </div>
            )}
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
