export const EVENT_ID = process.env.NEXT_PUBLIC_EVENT_ID || "gdg-busan-2026";

export const TEAM_EMOJIS = [
  "🚀", "🤖", "🎮", "🧠", "💡", "🔥", "⚡", "🎯",
  "🌟", "🎨", "🛸", "🧬", "🔮", "🎪", "🏆", "🦾",
  "🌈", "🎸", "🍕", "🦄", "🐙", "🌊", "🏔️", "🎭", "🧪",
];

export const CODE_PREFIX = "GDG";

export function generateUniqueCode(
  role: "P" | "J" | "A",
  index: number
): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${CODE_PREFIX}-${role}${String(index).padStart(2, "0")}${code}`;
}
