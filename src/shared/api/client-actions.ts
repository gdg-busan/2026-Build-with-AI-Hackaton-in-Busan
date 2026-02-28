"use client";

import {
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  serverTimestamp,
} from "firebase/firestore";
import { getFirebaseDb } from "@/shared/api/firebase";
import { EVENT_ID } from "@/shared/config/constants";
import { MISSIONS } from "@/features/mission/model/missions";
import type { MissionId, UserRole } from "@/shared/types";

// ─── Cheer (Direct Firebase) ────────────────────────────────────

const ALLOWED_EMOJIS = ["🔥", "❤️", "👏", "🎉", "⭐", "💪", "🚀", "👍"];

export async function sendCheer(
  teamId: string,
  emoji: string,
  userId: string,
  userName: string
): Promise<void> {
  if (!ALLOWED_EMOJIS.includes(emoji)) {
    throw new Error("허용되지 않은 이모지입니다");
  }

  const db = getFirebaseDb();
  const cheersRef = collection(
    db,
    `events/${EVENT_ID}/teams/${teamId}/cheers`
  );

  await addDoc(cheersRef, {
    teamId,
    emoji,
    userId,
    userName,
    createdAt: new Date(),
  });

  // Mission tracking (fire and forget)
  trackUniqueMissionClient(userId, "cheer_5_teams", teamId).catch(() => {});
}

// ─── Chat Message (Direct Firebase) ─────────────────────────────

export async function sendChatMessage(
  roomId: string,
  text: string,
  user: {
    uid: string;
    name: string;
    role: UserRole;
    teamId: string | null;
    teamName?: string | null;
  }
): Promise<string> {
  const trimmedText = text.trim();
  if (trimmedText.length === 0) throw new Error("메시지를 입력해주세요");
  if (trimmedText.length > 500) throw new Error("메시지는 500자 이내로 입력해주세요");

  const db = getFirebaseDb();
  const messagesRef = collection(
    db,
    `events/${EVENT_ID}/chatRooms/${roomId}/messages`
  );

  const docRef = await addDoc(messagesRef, {
    text: trimmedText,
    senderId: user.uid,
    senderName: user.name,
    senderRole: user.role,
    senderTeamId: user.teamId,
    senderTeamName: user.teamName ?? null,
    createdAt: serverTimestamp(),
    deleted: false,
    type: "text",
  });

  // Mission tracking (fire and forget)
  trackMissionClient(user.uid, "chat_10_messages").catch(() => {});

  return docRef.id;
}

// ─── Feedback (Direct Firebase) ──────────────────────────────────

const VALID_FEEDBACK_TYPES = ["cheer", "question", "feedback"];

export async function sendFeedback(
  teamId: string,
  text: string,
  type: string,
  anonymous: boolean,
  user: { uid: string; name: string }
): Promise<string> {
  const trimmedText = text.trim();
  if (trimmedText.length < 1 || trimmedText.length > 200) {
    throw new Error("피드백 내용은 1자 이상 200자 이하로 입력해 주세요");
  }
  if (!VALID_FEEDBACK_TYPES.includes(type)) {
    throw new Error("유효하지 않은 피드백 유형입니다");
  }

  const db = getFirebaseDb();
  const feedbacksRef = collection(
    db,
    `events/${EVENT_ID}/teams/${teamId}/feedbacks`
  );

  const docRef = await addDoc(feedbacksRef, {
    teamId,
    text: trimmedText,
    type,
    anonymous: !!anonymous,
    senderName: anonymous ? null : user.name,
    createdAt: serverTimestamp(),
    reply: null,
    repliedAt: null,
  });

  // Mission tracking (fire and forget)
  trackMissionClient(user.uid, "send_3_feedbacks").catch(() => {});

  return docRef.id;
}

// ─── Client-side Mission Tracking ────────────────────────────────

async function trackMissionClient(
  uniqueCode: string,
  missionId: MissionId,
  increment = 1
): Promise<void> {
  const mission = MISSIONS.find((m) => m.id === missionId);
  if (!mission) return;

  const db = getFirebaseDb();
  const missionRef = doc(
    db,
    `events/${EVENT_ID}/users/${uniqueCode}/missions/${missionId}`
  );

  const snap = await getDoc(missionRef);
  const data = snap.exists() ? snap.data() : {};
  const current = data?.current ?? 0;
  const alreadyCompleted = data?.completed ?? false;

  if (alreadyCompleted) return;

  const newCurrent = current + increment;
  const isNowComplete = mission.target > 0 && newCurrent >= mission.target;

  await setDoc(
    missionRef,
    {
      missionId,
      current: newCurrent,
      completed: isNowComplete,
      ...(isNowComplete ? { completedAt: serverTimestamp() } : {}),
    },
    { merge: true }
  );
}

async function trackUniqueMissionClient(
  uniqueCode: string,
  missionId: MissionId,
  itemId: string
): Promise<void> {
  const mission = MISSIONS.find((m) => m.id === missionId);
  if (!mission) return;

  const db = getFirebaseDb();
  const missionRef = doc(
    db,
    `events/${EVENT_ID}/users/${uniqueCode}/missions/${missionId}`
  );

  const snap = await getDoc(missionRef);
  const data = snap.exists() ? snap.data() : {};
  const alreadyCompleted = data?.completed ?? false;
  if (alreadyCompleted) return;

  const uniqueItems: string[] = data?.uniqueItems ?? [];
  if (uniqueItems.includes(itemId)) return;

  uniqueItems.push(itemId);
  const newCurrent = uniqueItems.length;
  const isNowComplete = mission.target > 0 && newCurrent >= mission.target;

  await setDoc(
    missionRef,
    {
      missionId,
      current: newCurrent,
      uniqueItems,
      completed: isNowComplete,
      ...(isNowComplete ? { completedAt: serverTimestamp() } : {}),
    },
    { merge: true }
  );
}
