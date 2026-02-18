import {
  doc,
  collection,
  onSnapshot,
  query,
  type DocumentData,
} from "firebase/firestore";
import { getFirebaseDb } from "./firebase";
import { EVENT_ID } from "./constants";
import type { EventConfig, Team } from "./types";

export function getEventRef() {
  return doc(getFirebaseDb(), "events", EVENT_ID);
}

export function getTeamsRef() {
  return collection(getFirebaseDb(), "events", EVENT_ID, "teams");
}

export function getVotesRef() {
  return collection(getFirebaseDb(), "events", EVENT_ID, "votes");
}

export function getUsersRef() {
  return collection(getFirebaseDb(), "events", EVENT_ID, "users");
}

export function parseEventConfig(data: DocumentData): EventConfig {
  return {
    id: EVENT_ID,
    status: data.status || "waiting",
    judgeWeight: data.judgeWeight ?? 0.8,
    participantWeight: data.participantWeight ?? 0.2,
    maxVotesPerUser: data.maxVotesPerUser ?? 3,
    votingDeadline: data.votingDeadline?.toDate() || null,
    title: data.title || "GDG Busan - Build with AI",
    createdAt: data.createdAt?.toDate() || new Date(),
  };
}

export function parseTeam(id: string, data: DocumentData): Team {
  return {
    id,
    name: data.name || "",
    nickname: data.nickname ?? null,
    description: data.description || "",
    emoji: data.emoji || "🚀",
    projectUrl: data.projectUrl ?? null,
    memberUserIds: data.memberUserIds || [],
    judgeVoteCount: data.judgeVoteCount || 0,
    participantVoteCount: data.participantVoteCount || 0,
  };
}

export function subscribeToEvent(callback: (config: EventConfig) => void) {
  return onSnapshot(getEventRef(), (snap) => {
    if (snap.exists()) {
      callback(parseEventConfig(snap.data()));
    }
  });
}

export function subscribeToTeams(callback: (teams: Team[]) => void) {
  return onSnapshot(query(getTeamsRef()), (snap) => {
    const teams = snap.docs.map((d) => parseTeam(d.id, d.data()));
    callback(teams);
  });
}

export function subscribeToVoteCount(callback: (count: number) => void) {
  return onSnapshot(query(getVotesRef()), (snap) => {
    callback(snap.size);
  });
}
