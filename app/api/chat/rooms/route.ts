import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { EVENT_ID } from "@/lib/constants";
import type { UserRole } from "@/lib/types";

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "인증 토큰이 필요합니다" },
        { status: 401 }
      );
    }
    const idToken = authHeader.slice(7);

    let decodedToken: {
      uid: string;
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

    const teamId: string | null = decodedToken.teamId || null;
    const chatRoomsCol = adminDb.collection(`events/${EVENT_ID}/chatRooms`);

    // Ensure global room exists
    const globalRef = chatRoomsCol.doc("global");
    const globalSnap = await globalRef.get();
    if (!globalSnap.exists) {
      await globalRef.set({
        type: "global",
        teamId: null,
        name: "전체 채팅",
        lastMessageAt: null,
        lastMessagePreview: null,
        lastMessageSender: null,
        messageCount: 0,
      });
    }

    // Ensure team room exists if user has a team
    if (teamId) {
      const teamRoomRef = chatRoomsCol.doc(teamId);
      const teamRoomSnap = await teamRoomRef.get();
      if (!teamRoomSnap.exists) {
        // Get team name
        const teamDoc = await adminDb
          .doc(`events/${EVENT_ID}/teams/${teamId}`)
          .get();
        const teamName = teamDoc.exists
          ? teamDoc.data()?.name ?? "팀"
          : "팀";
        await teamRoomRef.set({
          type: "team",
          teamId,
          name: `${teamName} 채팅`,
          lastMessageAt: null,
          lastMessagePreview: null,
          lastMessageSender: null,
          messageCount: 0,
        });
      }
    }

    // Return available rooms for this user
    const rooms: Array<{
      id: string;
      type: string;
      name: string;
      teamId: string | null;
    }> = [];

    const allRooms = await chatRoomsCol.get();
    for (const doc of allRooms.docs) {
      const data = doc.data();
      if (
        data.type === "global" ||
        data.teamId === teamId ||
        decodedToken.role === "admin"
      ) {
        rooms.push({
          id: doc.id,
          type: data.type,
          name: data.name,
          teamId: data.teamId ?? null,
        });
      }
    }

    return NextResponse.json({ rooms });
  } catch (err) {
    console.error("Chat rooms API error:", err);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
