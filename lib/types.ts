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
  description: string;
  emoji: string;
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
  emoji: string;
  judgeVoteCount: number;
  participantVoteCount: number;
  judgeNormalized: number;
  participantNormalized: number;
  finalScore: number;
  rank: number;
}
