"use client";

import { Users } from "lucide-react";

interface OnlineCounterProps {
  count: number;
}

export function OnlineCounter({ count }: OnlineCounterProps) {
  if (count <= 0) return null;

  return (
    <div className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00FF88] opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00FF88]" />
      </span>
      <Users className="w-3 h-3" />
      <span>{count}명 접속 중</span>
    </div>
  );
}
