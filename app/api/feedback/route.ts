import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { EVENT_ID } from "@/lib/constants";
import type { UserRole } from "@/lib/types";
import { trackMission } from "@/lib/mission-tracker";


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
      role?: UserRole;
      teamId?: string | null;
      name?: string;
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

    // Firestore-based rate limiting (5s between feedbacks)
    const rateLimitRef = adminDb.doc(`events/${EVENT_ID}/users/${uid}`);
    const rateLimitSnap = await rateLimitRef.get();
    if (rateLimitSnap.exists) {
      const rlData = rateLimitSnap.data()!;
      const lastFeedbackAt = rlData.lastFeedbackAt?.toDate?.() ?? null;
      if (lastFeedbackAt && Date.now() - lastFeedbackAt.getTime() < 5000) {
        return NextResponse.json(
          { error: "너무 빠르게 피드백을 보내고 있습니다. 잠시 후 다시 시도해 주세요." },
          { status: 429 }
        );
      }
    }

    // Parse request body
    const body = await req.json();
    const { teamId, text, type, anonymous } = body as {
      teamId: string;
      text: string;
      type: string;
      anonymous: boolean;
    };

    // Validate required fields
    if (!teamId || typeof teamId !== "string") {
      return NextResponse.json(
        { error: "팀 ID가 필요합니다" },
        { status: 400 }
      );
    }

    if (!text || typeof text !== "string" || text.trim().length < 1 || text.trim().length > 200) {
      return NextResponse.json(
        { error: "피드백 내용은 1자 이상 200자 이하로 입력해 주세요" },
        { status: 400 }
      );
    }

    const validTypes = ["cheer", "question", "feedback"];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: "유효하지 않은 피드백 유형입니다" },
        { status: 400 }
      );
    }

    // Verify team exists
    const teamRef = adminDb.doc(`events/${EVENT_ID}/teams/${teamId}`);
    const teamSnap = await teamRef.get();
    if (!teamSnap.exists) {
      return NextResponse.json(
        { error: "팀을 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    // Determine sender name
    let senderName: string | null = null;
    if (!anonymous) {
      // Fetch user name from Firestore
      const userRef = adminDb.doc(`events/${EVENT_ID}/users/${uid}`);
      const userSnap = await userRef.get();
      if (userSnap.exists) {
        senderName = userSnap.data()?.name || decodedToken.name || null;
      } else {
        senderName = decodedToken.name || null;
      }
    }

    // Write feedback document
    const feedbacksRef = adminDb.collection(
      `events/${EVENT_ID}/teams/${teamId}/feedbacks`
    );
    const feedbackDoc = await feedbacksRef.add({
      teamId,
      text: text.trim(),
      type,
      anonymous: !!anonymous,
      senderName,
      createdAt: FieldValue.serverTimestamp(),
      reply: null,
      repliedAt: null,
    });

    // Update rate limit timestamp
    await adminDb.doc(`events/${EVENT_ID}/users/${uid}`).update({
      lastFeedbackAt: FieldValue.serverTimestamp(),
    });

    // Track mission progress (fire and forget)
    trackMission(uid, "send_3_feedbacks").catch(() => {});

    return NextResponse.json({ success: true, feedbackId: feedbackDoc.id });
  } catch (err) {
    console.error("Feedback POST API error:", err);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
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

    const role: UserRole = (decodedToken.role as UserRole) || "participant";
    const userTeamId: string | null = decodedToken.teamId || null;

    // Parse request body
    const body = await req.json();
    const { teamId, feedbackId, reply } = body as {
      teamId: string;
      feedbackId: string;
      reply: string;
    };

    if (!teamId || typeof teamId !== "string") {
      return NextResponse.json(
        { error: "팀 ID가 필요합니다" },
        { status: 400 }
      );
    }

    if (!feedbackId || typeof feedbackId !== "string") {
      return NextResponse.json(
        { error: "피드백 ID가 필요합니다" },
        { status: 400 }
      );
    }

    if (!reply || typeof reply !== "string" || reply.trim().length < 1) {
      return NextResponse.json(
        { error: "답글 내용이 필요합니다" },
        { status: 400 }
      );
    }

    // Only team members or admin can reply
    if (role !== "admin" && userTeamId !== teamId) {
      return NextResponse.json(
        { error: "해당 팀의 멤버 또는 관리자만 답글을 달 수 있습니다" },
        { status: 403 }
      );
    }

    const feedbackRef = adminDb.doc(
      `events/${EVENT_ID}/teams/${teamId}/feedbacks/${feedbackId}`
    );
    const feedbackSnap = await feedbackRef.get();
    if (!feedbackSnap.exists) {
      return NextResponse.json(
        { error: "피드백을 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    await feedbackRef.update({
      reply: reply.trim(),
      repliedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Feedback PUT API error:", err);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
