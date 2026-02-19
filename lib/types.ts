export type EventStatus = "waiting" | "voting" | "closed" | "revealed";
export type UserRole = "participant" | "judge" | "admin";

export interface EventConfig {
  id: string;
  status: EventStatus;
  judgeWeight: number;
  participantWeight: number;
  maxVotesPerUser: number;
  votingDeadline: Date | null;
  title: string;
  createdAt: Date;
}

export interface Team {
  id: string;
  name: string;
  nickname: string | null;
  description: string;
  emoji: string;
  projectUrl: string | null;
  memberUserIds: string[];
  judgeVoteCount: number;
  participantVoteCount: number;
  cheerCount?: number;
  demoUrl?: string | null;
  githubUrl?: string | null;
  techStack?: string[];
}

export interface User {
  uniqueCode: string;
  name: string;
  role: UserRole;
  teamId: string | null;
  hasVoted: boolean;
  bio: string | null;
}

export interface MemberProfile {
  uniqueCode: string;
  name: string;
  bio: string | null;
  techTags?: string[];
}

export interface Vote {
  voterId: string;
  selectedTeams: string[];
  role: UserRole;
  timestamp: Date;
}

export interface TeamScore {
  teamId: string;
  teamName: string;
  teamNickname: string | null;
  emoji: string;
  judgeVoteCount: number;
  participantVoteCount: number;
  judgeNormalized: number;
  participantNormalized: number;
  finalScore: number;
  rank: number;
}

// Chat types
export type ChatRoomType = "global" | "team";
export type ChatMessageType = "text" | "system";

export interface ChatRoom {
  id: string;
  type: ChatRoomType;
  teamId: string | null;
  name: string;
  lastMessageAt: Date | null;
  lastMessagePreview: string | null;
  lastMessageSender: string | null;
  messageCount: number;
}

export interface ChatMessage {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  senderTeamId: string | null;
  senderTeamName: string | null;
  createdAt: Date;
  deleted: boolean;
  deletedBy?: string;
  type: ChatMessageType;
}

export interface RoomReadState {
  lastReadAt: Date;
}

// Announcement ticker
export interface Announcement {
  id: string;
  text: string;
  type: "info" | "warning" | "success";
  createdAt: Date;
  expiresAt: Date | null;
  active: boolean;
}

// Team cheer reactions
export interface TeamCheer {
  id: string;
  teamId: string;
  emoji: string;
  userId: string;
  createdAt: Date;
}

// Project showcase
export interface TeamShowcase {
  demoUrl: string | null;
  githubUrl: string | null;
  screenshots: string[];
  techStack: string[];
}

// Anonymous feedback
export interface TeamFeedback {
  id: string;
  teamId: string;
  text: string;
  type: "cheer" | "question" | "feedback";
  anonymous: boolean;
  senderName: string | null;
  createdAt: Date;
  reply: string | null;
  repliedAt: Date | null;
}

// Missions & badges
export type MissionId =
  | "visit_all_teams"
  | "send_3_feedbacks"
  | "complete_profile"
  | "first_vote"
  | "chat_10_messages"
  | "cheer_5_teams";

export interface Mission {
  id: MissionId;
  title: string;
  description: string;
  icon: string;
  target: number; // 0 means dynamic (resolved at runtime, e.g. team count)
}

export interface UserMissionProgress {
  missionId: MissionId;
  current: number;
  completed: boolean;
  completedAt: Date | null;
  uniqueItems?: string[]; // for unique-tracking missions
}

// Tech stack tags
export interface UserTechProfile {
  tags: string[];
  updatedAt: Date;
}
