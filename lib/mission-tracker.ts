import { adminDb } from "@/lib/firebase-admin";
import { EVENT_ID } from "@/lib/constants";
import { MISSIONS } from "@/lib/missions";
import type { MissionId } from "@/lib/types";
import { FieldValue } from "firebase-admin/firestore";

/**
 * Server-side mission progress tracker.
 * Called from API routes after successful actions.
 */
export async function trackMission(
  uniqueCode: string,
  missionId: MissionId,
  increment = 1
): Promise<void> {
  const mission = MISSIONS.find((m) => m.id === missionId);
  if (!mission) return;

  const missionRef = adminDb.doc(
    `events/${EVENT_ID}/users/${uniqueCode}/missions/${missionId}`
  );

  const snap = await missionRef.get();
  const current = snap.exists ? (snap.data()?.current ?? 0) : 0;
  const alreadyCompleted = snap.exists ? (snap.data()?.completed ?? false) : false;

  if (alreadyCompleted) return;

  const newCurrent = current + increment;
  const isNowComplete = mission.target > 0 && newCurrent >= mission.target;

  await missionRef.set(
    {
      missionId,
      current: newCurrent,
      completed: isNowComplete,
      ...(isNowComplete ? { completedAt: FieldValue.serverTimestamp() } : {}),
    },
    { merge: true }
  );

  if (isNowComplete) {
    await checkAllMissionsCompleted(uniqueCode);
  }
}

/**
 * Track mission progress with unique item deduplication.
 * Only increments if itemId hasn't been tracked before.
 * Used for missions like "cheer 5 different teams".
 */
export async function trackUniqueMission(
  uniqueCode: string,
  missionId: MissionId,
  itemId: string,
  dynamicTarget?: number
): Promise<void> {
  const mission = MISSIONS.find((m) => m.id === missionId);
  if (!mission) return;

  const missionRef = adminDb.doc(
    `events/${EVENT_ID}/users/${uniqueCode}/missions/${missionId}`
  );

  const snap = await missionRef.get();
  const data = snap.exists ? snap.data()! : {};
  const alreadyCompleted = data.completed ?? false;
  if (alreadyCompleted) return;

  const uniqueItems: string[] = data.uniqueItems ?? [];
  if (uniqueItems.includes(itemId)) return; // already tracked this item

  uniqueItems.push(itemId);
  const newCurrent = uniqueItems.length;
  const target = dynamicTarget ?? mission.target;
  const isNowComplete = target > 0 && newCurrent >= target;

  await missionRef.set(
    {
      missionId,
      current: newCurrent,
      uniqueItems,
      completed: isNowComplete,
      ...(isNowComplete ? { completedAt: FieldValue.serverTimestamp() } : {}),
    },
    { merge: true }
  );

  if (isNowComplete) {
    await checkAllMissionsCompleted(uniqueCode);
  }
}

/**
 * Check if user profile is complete (name + bio + techTags).
 */
export async function checkProfileComplete(uniqueCode: string): Promise<void> {
  const userRef = adminDb.doc(`events/${EVENT_ID}/users/${uniqueCode}`);
  const userSnap = await userRef.get();
  if (!userSnap.exists) return;

  const data = userSnap.data()!;
  const hasName = !!data.name;
  const hasBio = !!data.bio;
  const hasTechTags = Array.isArray(data.techTags) && data.techTags.length > 0;

  if (hasName && hasBio && hasTechTags) {
    await trackMission(uniqueCode, "complete_profile", 1);
  }
}

/**
 * Check if all missions are completed and record the timestamp.
 * Only records on first completion (preserves earliest timestamp).
 */
async function checkAllMissionsCompleted(uniqueCode: string): Promise<void> {
  const userRef = adminDb.doc(`events/${EVENT_ID}/users/${uniqueCode}`);
  const userSnap = await userRef.get();
  if (!userSnap.exists) return;

  // Skip if already recorded
  if (userSnap.data()?.allMissionsCompletedAt) return;

  const definedIds = new Set<string>(MISSIONS.map((m) => m.id));
  const missionsSnap = await userRef.collection("missions").get();
  const completedMissions = missionsSnap.docs.filter(
    (d) => definedIds.has(d.id) && d.data().completed === true
  );

  // Check if all defined missions are completed
  if (completedMissions.length >= MISSIONS.length) {
    await userRef.update({
      allMissionsCompletedAt: FieldValue.serverTimestamp(),
    });
  }
}
