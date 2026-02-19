"use client";

import { useEffect, useState, useCallback } from "react";
import {
  doc,
  onSnapshot,
  setDoc,
  serverTimestamp,
  collection,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { EVENT_ID } from "@/lib/constants";
import { MISSIONS } from "@/lib/missions";
import type { UserMissionProgress, MissionId } from "@/lib/types";

export function useMissions(uniqueCode: string | undefined) {
  const [missions, setMissions] = useState<UserMissionProgress[]>([]);

  useEffect(() => {
    if (!uniqueCode) return;

    const missionsCol = collection(
      getFirebaseDb(),
      "events",
      EVENT_ID,
      "users",
      uniqueCode,
      "missions"
    );

    const unsub = onSnapshot(missionsCol, (snap) => {
      const progressMap: Record<string, UserMissionProgress> = {};
      snap.docs.forEach((d) => {
        const data = d.data();
        progressMap[d.id] = {
          missionId: d.id as MissionId,
          current: data.current ?? 0,
          completed: data.completed ?? false,
          completedAt: data.completedAt?.toDate() ?? null,
          uniqueItems: data.uniqueItems ?? undefined,
        };
      });

      // Merge with all defined missions (so unstarted ones show as 0 progress)
      const merged: UserMissionProgress[] = MISSIONS.map((m) => {
        return (
          progressMap[m.id] ?? {
            missionId: m.id,
            current: 0,
            completed: false,
            completedAt: null,
          }
        );
      });

      setMissions(merged);
    });

    return () => unsub();
  }, [uniqueCode]);

  const updateProgress = useCallback(
    async (missionId: MissionId, increment = 1) => {
      if (!uniqueCode) return;

      const mission = MISSIONS.find((m) => m.id === missionId);
      if (!mission) return;

      const existing = missions.find((m) => m.missionId === missionId);
      if (existing?.completed) return;

      const currentVal = existing?.current ?? 0;
      const newCurrent = currentVal + increment;
      const isNowComplete = mission.target > 0 && newCurrent >= mission.target;

      const missionRef = doc(
        getFirebaseDb(),
        "events",
        EVENT_ID,
        "users",
        uniqueCode,
        "missions",
        missionId
      );

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
    },
    [uniqueCode, missions]
  );

  /**
   * Track unique item progress (e.g., visiting unique teams).
   * Only increments if itemId hasn't been tracked before.
   * dynamicTarget overrides the static mission target (for target=0 missions).
   */
  const updateUniqueProgress = useCallback(
    async (missionId: MissionId, itemId: string, dynamicTarget?: number) => {
      if (!uniqueCode) return;

      const mission = MISSIONS.find((m) => m.id === missionId);
      if (!mission) return;

      const existing = missions.find((m) => m.missionId === missionId);
      if (existing?.completed) return;

      const uniqueItems = existing?.uniqueItems ?? [];
      if (uniqueItems.includes(itemId)) return; // already tracked

      const newUniqueItems = [...uniqueItems, itemId];
      const newCurrent = newUniqueItems.length;
      const target = dynamicTarget ?? mission.target;
      const isNowComplete = target > 0 && newCurrent >= target;

      const missionRef = doc(
        getFirebaseDb(),
        "events",
        EVENT_ID,
        "users",
        uniqueCode,
        "missions",
        missionId
      );

      await setDoc(
        missionRef,
        {
          missionId,
          current: newCurrent,
          uniqueItems: newUniqueItems,
          completed: isNowComplete,
          ...(isNowComplete ? { completedAt: serverTimestamp() } : {}),
        },
        { merge: true }
      );
    },
    [uniqueCode, missions]
  );

  const completedCount = missions.filter((m) => m.completed).length;
  const totalCount = MISSIONS.length;

  return { missions, updateProgress, updateUniqueProgress, completedCount, totalCount };
}
