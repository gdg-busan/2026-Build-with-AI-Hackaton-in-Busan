import type { Mission } from "@/shared/types";

export const MISSIONS: Mission[] = [
  {
    id: "visit_all_teams",
    title: "탐험가",
    description: "모든 팀의 상세정보 둘러보기",
    icon: "👀",
    target: 0, // dynamic: resolved to team count at runtime
  },
  {
    id: "send_3_feedbacks",
    title: "피드백 마스터",
    description: "3개의 피드백 남기기",
    icon: "💬",
    target: 3,
  },
  {
    id: "complete_profile",
    title: "자기소개",
    description: "프로필 완성하기 (이름+바이오+기술태그)",
    icon: "✏️",
    target: 1,
  },
  {
    id: "first_vote",
    title: "민주주의",
    description: "첫 투표 완료하기",
    icon: "🗳️",
    target: 1,
  },
  {
    id: "chat_10_messages",
    title: "수다쟁이",
    description: "채팅 10회 보내기",
    icon: "💬",
    target: 10,
  },
  {
    id: "cheer_5_teams",
    title: "치어리더",
    description: "5팀 응원하기",
    icon: "🎉",
    target: 5,
  },
];

export const TECH_TAGS = [
  "React",
  "Next.js",
  "TypeScript",
  "JavaScript",
  "Python",
  "Firebase",
  "Node.js",
  "Flutter",
  "Kotlin",
  "Swift",
  "AI/ML",
  "Design",
  "PM",
  "Go",
  "Rust",
  "Java",
];
