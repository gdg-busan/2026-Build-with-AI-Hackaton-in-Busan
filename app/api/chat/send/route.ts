import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { EVENT_ID } from "@/lib/constants";
import type { UserRole } from "@/lib/types";

// In-memory rate limiting: uid -> last message timestamp (ms)
const lastMessageTime = new Map<string, number>();

export async function POST(req: NextRequest) {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "인증 토큰이 필요합니다" },
        { status: 401 }
      );
    }
    const idToken = authHeader.slice(7);

    // Verify Firebase ID token
    let decodedToken: {
      uid: string;
      uniqueCode?: string;
      name?: string;
      role?: UserRole;
      teamId?: string | null;
    };
    try {
      decodedToken = await adminAuth.verifyIdToken(idToken);
    } catch {
      return NextResponse.json(
        { error: "유효하지 않은 인증 토큰입니다" },
        { status: 401 }
      );
    }

    const uid = decodedToken.uid;
    const uniqueCode: string = decodedToken.uniqueCode || uid;
    const name: string = decodedToken.name || "알 수 없음";
    const role: UserRole = (decodedToken.role as UserRole) || "participant";
    const teamId: string | null = decodedToken.teamId || null;

    // Parse request body
    const body = await req.json();
    const { roomId, text }: { roomId: string; text: string } = body;

    // Validate text
    if (typeof text !== "string" || text.trim().length === 0) {
      return NextResponse.json(
        { error: "메시지를 입력해주세요" },
        { status: 400 }
      );
    }
    const trimmedText = text.trim();
    if (trimmedText.length > 500) {
      return NextResponse.json(
        { error: "메시지는 500자 이내로 입력해주세요" },
        { status: 400 }
      );
    }

    // Validate roomId
    if (typeof roomId !== "string" || roomId.trim().length === 0) {
      return NextResponse.json(
        { error: "채팅방 ID가 필요합니다" },
        { status: 400 }
      );
    }

    // Check chatRoom exists
    const roomRef = adminDb.doc(`events/${EVENT_ID}/chatRooms/${roomId}`);
    const roomSnap = await roomRef.get();
    if (!roomSnap.exists) {
      return NextResponse.json(
        { error: "채팅방을 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    const roomData = roomSnap.data()!;

    // For team rooms: check user's team matches, unless admin
    if (roomData.type === "team" && role !== "admin") {
      if (!teamId || teamId !== roomData.teamId) {
        return NextResponse.json(
          { error: "해당 채팅방에 접근할 수 없습니다" },
          { status: 403 }
        );
      }
    }

    // Check if user is muted
    const userRef = adminDb.doc(`events/${EVENT_ID}/users/${uniqueCode}`);
    const userSnap = await userRef.get();
    if (userSnap.exists) {
      const userData = userSnap.data()!;
      if (userData.chatMutedUntil) {
        const mutedUntil: Date =
          userData.chatMutedUntil.toDate?.() ??
          new Date(userData.chatMutedUntil);
        if (mutedUntil > new Date()) {
          return NextResponse.json(
            { error: "현재 채팅이 제한된 상태입니다" },
            { status: 403 }
          );
        }
      }
    }

    // Simple in-memory rate limiting (1500ms between messages)
    const now = Date.now();
    const last = lastMessageTime.get(uid);
    if (last !== undefined && now - last < 1500) {
      return NextResponse.json(
        { error: "메시지를 너무 빠르게 전송하고 있습니다. 잠시 후 다시 시도해주세요" },
        { status: 429 }
      );
    }
    lastMessageTime.set(uid, now);

    // Look up team name if user has a team
    let senderTeamName: string | null = null;
    if (teamId) {
      const teamDoc = await adminDb.doc(`events/${EVENT_ID}/teams/${teamId}`).get();
      if (teamDoc.exists) {
        const teamData = teamDoc.data()!;
        senderTeamName = teamData.nickname || teamData.name || null;
      }
    }

    // Atomic batch write
    const batch = adminDb.batch();

    // Add message doc
    const messagesRef = adminDb.collection(
      `events/${EVENT_ID}/chatRooms/${roomId}/messages`
    );
    const messageRef = messagesRef.doc();
    batch.set(messageRef, {
      text: trimmedText,
      senderId: uid,
      senderName: name,
      senderRole: role,
      senderTeamId: teamId,
      senderTeamName,
      createdAt: FieldValue.serverTimestamp(),
      deleted: false,
      type: "text",
    });

    // Update chatRoom metadata
    batch.update(roomRef, {
      lastMessageAt: FieldValue.serverTimestamp(),
      lastMessagePreview: trimmedText.slice(0, 50),
      lastMessageSender: name,
      messageCount: FieldValue.increment(1),
    });

    await batch.commit();

    return NextResponse.json({ success: true, messageId: messageRef.id });
  } catch (err) {
    console.error("Chat send API error:", err);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
