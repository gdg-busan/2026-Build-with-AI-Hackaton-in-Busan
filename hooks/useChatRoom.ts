"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  doc,
  getDocs,
  startAfter,
  setDoc,
  serverTimestamp,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { EVENT_ID } from "@/lib/constants";
import type { ChatMessage } from "@/lib/types";

const PAGE_SIZE = 40;

export function useChatRoom(roomId: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const oldestDocRef = useRef<QueryDocumentSnapshot | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const toDate = (value: unknown): Date => {
    if (!value) return new Date(0);
    if (value instanceof Date) return value;
    if (
      typeof value === "object" &&
      value !== null &&
      "toDate" in value &&
      typeof (value as { toDate: () => Date }).toDate === "function"
    ) {
      return (value as { toDate: () => Date }).toDate();
    }
    return new Date(0);
  };

  const docToMessage = (d: QueryDocumentSnapshot): ChatMessage => {
    const data = d.data();
    return {
      id: d.id,
      text: data.text ?? "",
      senderId: data.senderId ?? "",
      senderName: data.senderName ?? "",
      senderRole: data.senderRole ?? "participant",
      senderTeamId: data.senderTeamId ?? null,
      senderTeamName: data.senderTeamName ?? null,
      createdAt: toDate(data.createdAt),
      deleted: data.deleted ?? false,
      deletedBy: data.deletedBy,
      type: data.type ?? "text",
    } satisfies ChatMessage;
  };

  useEffect(() => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }

    if (!roomId) {
      setMessages([]);
      setLoading(false);
      setError(null);
      setHasMore(false);
      oldestDocRef.current = null;
      return;
    }

    setLoading(true);
    setError(null);
    setMessages([]);
    oldestDocRef.current = null;

    const db = getFirebaseDb();
    const messagesRef = collection(
      db,
      "events",
      EVENT_ID,
      "chatRooms",
      roomId,
      "messages"
    );
    const q = query(messagesRef, orderBy("createdAt", "desc"), limit(PAGE_SIZE));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs;
        const mapped = docs.map(docToMessage).reverse();
        setMessages(mapped);
        setHasMore(docs.length === PAGE_SIZE);
        if (docs.length > 0) {
          oldestDocRef.current = docs[docs.length - 1];
        }
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    unsubscribeRef.current = unsubscribe;

    return () => {
      unsubscribe();
      unsubscribeRef.current = null;
    };
  }, [roomId]);

  const loadMore = useCallback(async () => {
    if (!roomId || !oldestDocRef.current || !hasMore) return;

    const db = getFirebaseDb();
    const messagesRef = collection(
      db,
      "events",
      EVENT_ID,
      "chatRooms",
      roomId,
      "messages"
    );
    const q = query(
      messagesRef,
      orderBy("createdAt", "desc"),
      startAfter(oldestDocRef.current),
      limit(PAGE_SIZE)
    );

    try {
      const snapshot = await getDocs(q);
      const docs = snapshot.docs;
      const older = docs.map(docToMessage).reverse();
      setMessages((prev) => [...older, ...prev]);
      setHasMore(docs.length === PAGE_SIZE);
      if (docs.length > 0) {
        oldestDocRef.current = docs[docs.length - 1];
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load more messages");
    }
  }, [roomId, hasMore]);

  return { messages, loading, error, loadMore, hasMore };
}

export function useUnreadCounts(
  userId: string | null,
  roomIds: string[]
): { unreadMap: Record<string, boolean> } {
  const [unreadMap, setUnreadMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!userId || roomIds.length === 0) {
      setUnreadMap({});
      return;
    }

    const db = getFirebaseDb();
    const unsubscribes: (() => void)[] = [];

    const lastMessageAtMap: Record<string, Date | null> = {};
    const lastReadAtMap: Record<string, Date | null> = {};

    const recompute = () => {
      const next: Record<string, boolean> = {};
      for (const rid of roomIds) {
        const lma = lastMessageAtMap[rid] ?? null;
        const lra = lastReadAtMap[rid] ?? null;
        if (lma === null) {
          next[rid] = false;
        } else if (lra === null) {
          next[rid] = true;
        } else {
          next[rid] = lma > lra;
        }
      }
      setUnreadMap(next);
    };

    for (const rid of roomIds) {
      lastMessageAtMap[rid] = null;
      lastReadAtMap[rid] = null;

      const roomDocRef = doc(db, "events", EVENT_ID, "chatRooms", rid);
      const unsubRoom = onSnapshot(roomDocRef, (snap) => {
        const data = snap.data();
        if (data?.lastMessageAt) {
          const raw = data.lastMessageAt;
          lastMessageAtMap[rid] =
            typeof raw === "object" && "toDate" in raw
              ? (raw as { toDate: () => Date }).toDate()
              : null;
        } else {
          lastMessageAtMap[rid] = null;
        }
        recompute();
      });

      const stateDocRef = doc(
        db,
        "events",
        EVENT_ID,
        "users",
        userId,
        "roomState",
        rid
      );
      const unsubState = onSnapshot(stateDocRef, (snap) => {
        const data = snap.data();
        if (data?.lastReadAt) {
          const raw = data.lastReadAt;
          lastReadAtMap[rid] =
            typeof raw === "object" && "toDate" in raw
              ? (raw as { toDate: () => Date }).toDate()
              : null;
        } else {
          lastReadAtMap[rid] = null;
        }
        recompute();
      });

      unsubscribes.push(unsubRoom, unsubState);
    }

    return () => {
      for (const unsub of unsubscribes) {
        unsub();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, roomIds.join(",")]);

  return { unreadMap };
}

export async function markAsRead(
  userId: string,
  roomId: string
): Promise<void> {
  const db = getFirebaseDb();
  const stateDocRef = doc(
    db,
    "events",
    EVENT_ID,
    "users",
    userId,
    "roomState",
    roomId
  );
  await setDoc(stateDocRef, { lastReadAt: serverTimestamp() }, { merge: true });
}
