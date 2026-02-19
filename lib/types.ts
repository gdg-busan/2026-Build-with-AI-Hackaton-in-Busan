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
