import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { EVENT_ID } from "@/lib/constants";
import type { UserRole } from "@/lib/types";

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
    const role: UserRole = (decodedToken.role as UserRole) || "participant";
    const userTeamId: string | null = decodedToken.teamId || null;

    // Parse request body
    const body = await req.json();
    const { selectedTeams }: { selectedTeams: string[] } = body;

    if (!Array.isArray(selectedTeams) || selectedTeams.length === 0) {
      return NextResponse.json(
        { error: "선택한 팀이 없습니다" },
        { status: 400 }
      );
    }

    const eventRef = adminDb.doc(`events/${EVENT_ID}`);
    const eventSnap = await eventRef.get();

    if (!eventSnap.exists) {
      return NextResponse.json(
        { error: "이벤트를 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    const eventData = eventSnap.data()!;

    // Validate: event must be in "voting" status
    if (eventData.status !== "voting") {
      return NextResponse.json(
        { error: "현재 투표 기간이 아닙니다" },
        { status: 400 }
      );
    }

    const maxVotesPerUser: number = eventData.maxVotesPerUser ?? 3;

    // Validate: selectedTeams count
    if (selectedTeams.length > maxVotesPerUser) {
      return NextResponse.json(
        { error: `최대 ${maxVotesPerUser}팀까지 투표할 수 있습니다` },
        { status: 400 }
      );
    }

    // Validate: user hasn't already voted
    const voteRef = adminDb.doc(`events/${EVENT_ID}/votes/${uid}`);
    const voteSnap = await voteRef.get();
    if (voteSnap.exists) {
      return NextResponse.json(
        { error: "이미 투표하셨습니다" },
        { status: 409 }
      );
    }

    // Validate: selectedTeams doesn't include user's own team
    if (userTeamId && selectedTeams.includes(userTeamId)) {
      return NextResponse.json(
        { error: "자신의 팀에는 투표할 수 없습니다" },
        { status: 400 }
      );
    }

    // Validate: all selected teams exist
    const teamRefs = selectedTeams.map((teamId) =>
      adminDb.doc(`events/${EVENT_ID}/teams/${teamId}`)
    );
    const teamSnaps = await adminDb.getAll(...teamRefs);
    for (const snap of teamSnaps) {
      if (!snap.exists) {
        return NextResponse.json(
          { error: `팀을 찾을 수 없습니다: ${snap.id}` },
          { status: 400 }
        );
      }
    }

    // Atomic batch write
    const batch = adminDb.batch();

    // Write vote document
    batch.set(voteRef, {
      voterId: uid,
      selectedTeams,
      role,
      timestamp: new Date(),
    });

    // Increment vote counts on each team
    const voteField =
      role === "judge" ? "judgeVoteCount" : "participantVoteCount";
    for (const teamId of selectedTeams) {
      const teamRef = adminDb.doc(`events/${EVENT_ID}/teams/${teamId}`);
      batch.update(teamRef, {
        [voteField]: FieldValue.increment(1),
      });
    }

    // Update user's hasVoted flag
    const userRef = adminDb.doc(`events/${EVENT_ID}/users/${uid}`);
    batch.update(userRef, { hasVoted: true });

    await batch.commit();

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Vote API error:", err);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
