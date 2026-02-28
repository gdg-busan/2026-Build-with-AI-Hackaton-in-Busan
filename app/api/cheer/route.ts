import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/shared/api/firebase-admin";
import { EVENT_ID } from "@/shared/config/constants";
import { trackUniqueMission } from "@/features/mission/api/mission-tracker";

const ALLOWED_EMOJIS = ["🔥", "❤️", "👏", "🎉", "⭐", "💪", "🚀", "👍"];


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
    let uid: string;
    let senderName: string;
    try {
      const decodedToken = await adminAuth.verifyIdToken(idToken);
      uid = decodedToken.uid;
      senderName = (decodedToken as Record<string, unknown>).name as string || "알 수 없음";
    } catch {
      return NextResponse.json(
        { error: "유효하지 않은 인증 토큰입니다" },
        { status: 401 }
      );
    }

    // Firestore-based rate limiting (3s between cheers)
    const userRef = adminDb.doc(`events/${EVENT_ID}/users/${uid}`);
    const userSnap = await userRef.get();
    if (userSnap.exists) {
      const userData = userSnap.data()!;
      const lastCheerAt = userData.lastCheerAt?.toDate?.() ?? null;
      if (lastCheerAt && Date.now() - lastCheerAt.getTime() < 3000) {
        return NextResponse.json(
          { error: "너무 빠릅니다. 잠시 후 다시 시도해주세요" },
          { status: 429 }
        );
      }
    }

    // Parse request body
    const body = await req.json();
    const { teamId, emoji }: { teamId: string; emoji: string } = body;

    if (!teamId || typeof teamId !== "string") {
      return NextResponse.json(
        { error: "teamId가 필요합니다" },
        { status: 400 }
      );
    }

    if (!ALLOWED_EMOJIS.includes(emoji)) {
      return NextResponse.json(
        { error: "허용되지 않은 이모지입니다" },
        { status: 400 }
      );
    }

    // Validate team exists
    const teamRef = adminDb.doc(`events/${EVENT_ID}/teams/${teamId}`);
    const teamSnap = await teamRef.get();
    if (!teamSnap.exists) {
      return NextResponse.json(
        { error: "팀을 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    // Atomic batch write: add cheer doc + increment cheerCount
    const batch = adminDb.batch();

    const cheerRef = adminDb
      .collection(`events/${EVENT_ID}/teams/${teamId}/cheers`)
      .doc();
    batch.set(cheerRef, {
      teamId,
      emoji,
      userId: uid,
      userName: senderName,
      createdAt: new Date(),
    });

    batch.update(teamRef, {
      cheerCount: FieldValue.increment(1),
    });

    // Update rate limit timestamp
    batch.update(userRef, { lastCheerAt: FieldValue.serverTimestamp() });

    await batch.commit();

    // Track mission progress — unique per team (fire and forget)
    trackUniqueMission(uid, "cheer_5_teams", teamId).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Cheer API error:", err);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
