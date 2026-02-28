"use client";

import { TECH_TAGS } from "@/features/mission/model/missions";

interface TechTagInputProps {
  selectedTags: string[];
  onChange: (tags: string[]) => void;
  maxTags?: number;
}

export function TechTagInput({
  selectedTags,
  onChange,
  maxTags = 5,
}: TechTagInputProps) {
  const handleToggle = (tag: string) => {
    if (selectedTags.includes(tag)) {
      onChange(selectedTags.filter((t) => t !== tag));
    } else {
      if (selectedTags.length >= maxTags) return;
      onChange([...selectedTags, tag]);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {TECH_TAGS.map((tag) => {
          const selected = selectedTags.includes(tag);
          const atMax = selectedTags.length >= maxTags && !selected;
          return (
            <button
              key={tag}
              type="button"
              onClick={() => handleToggle(tag)}
              disabled={atMax}
              className={`px-2.5 py-1 rounded-md text-xs font-mono border transition-all ${
                selected
                  ? "border-primary bg-primary/10 text-primary shadow-[0_0_6px_rgba(0,255,136,0.3)]"
                  : atMax
                  ? "border-border/40 text-muted-foreground/40 cursor-not-allowed"
                  : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground cursor-pointer"
              }`}
            >
              {tag}
            </button>
          );
        })}
      </div>
      <p className="text-[10px] text-muted-foreground/60 font-mono">
        {selectedTags.length}/{maxTags} 선택됨
      </p>
    </div>
  );
}
