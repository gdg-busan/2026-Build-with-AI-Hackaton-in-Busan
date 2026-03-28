"use client";

interface MyTeamBadgeProps {
  position?: "center" | "right";
}

export function MyTeamBadge({ position = "center" }: MyTeamBadgeProps) {
  return (
    <span
      className={`absolute -top-2.5 px-2 py-0.5 bg-[#FFD700] text-[#0A0E1A] font-mono text-[10px] font-bold rounded-full whitespace-nowrap z-10 ${
        position === "center"
          ? "left-1/2 -translate-x-1/2"
          : "right-4"
      }`}
    >
      YOUR TEAM!
    </span>
  );
}
