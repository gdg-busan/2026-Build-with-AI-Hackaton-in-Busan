import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { EVENT_ID } from "@/lib/constants";
import type { UserRole, VotingPhase } from "@/lib/types";

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
    const { selectedTeams: rawSelectedTeams } = body;

    if (!Array.isArray(rawSelectedTeams) || rawSelectedTeams.length === 0) {
      return NextResponse.json(
        { error: "선택한 팀이 없습니다" },
        { status: 400 }
      );
    }

    // Deduplicate to prevent counting same team multiple times
    const selectedTeams = [...new Set(rawSelectedTeams as string[])];

    const eventRef = adminDb.doc(`events/${EVENT_ID}`);
    const eventSnap = await eventRef.get();

    if (!eventSnap.exists) {
      return NextResponse.json(
        { error: "이벤트를 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    const eventData = eventSnap.data()!;
    const eventStatus = eventData.status as string;

    // Detect current phase from event status
    let phase: VotingPhase;
    if (eventStatus === "voting_p1") {
      phase = "p1";
    } else if (eventStatus === "voting_p2") {
      phase = "p2";
    } else {
      return NextResponse.json(
        { error: "투표 기간이 아닙니다" },
        { status: 400 }
      );
    }

    // Phase-based role validation
    if (phase === "p1" && role !== "participant") {
      return NextResponse.json(
        { error: "참가자 투표 기간입니다" },
        { status: 403 }
      );
    }
    if (phase === "p2" && role !== "judge") {
      return NextResponse.json(
        { error: "심사위원 투표 기간입니다" },
        { status: 403 }
      );
    }

    // Use phase-specific limit with fallback to legacy maxVotesPerUser for backward compat
    const maxVotesPerUser: number =
      phase === "p1"
        ? (eventData.maxVotesP1 ?? eventData.maxVotesPerUser ?? 3)
        : (eventData.maxVotesP2 ?? eventData.maxVotesPerUser ?? 3);

    // Validate: selectedTeams count
    if (selectedTeams.length > maxVotesPerUser) {
      return NextResponse.json(
        { error: `최대 ${maxVotesPerUser}팀까지 투표할 수 있습니다` },
        { status: 400 }
      );
    }

    // Phase 2: selectedTeams must be subset of phase1SelectedTeamIds
    if (phase === "p2") {
      const phase1SelectedTeamIds: string[] =
        eventData.phase1SelectedTeamIds ?? [];
      const invalidTeams = selectedTeams.filter(
        (teamId) => !phase1SelectedTeamIds.includes(teamId)
      );
      if (invalidTeams.length > 0) {
        return NextResponse.json(
          { error: "1차 투표에서 선정된 팀에만 투표할 수 있습니다" },
          { status: 400 }
        );
      }
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
      if (snap.data()?.isHidden) {
        return NextResponse.json(
          { error: `숨겨진 팀에는 투표할 수 없습니다: ${snap.id}` },
          { status: 400 }
        );
      }
    }

    // Atomic transaction: prevents TOCTOU race on duplicate vote check
    const userRef = adminDb.doc(`events/${EVENT_ID}/users/${uid}`);
    const hasVotedField = phase === "p1" ? "hasVotedP1" : "hasVotedP2";
    const voteDocId = `${phase}_${uid}`;
    const voteRef = adminDb.doc(`events/${EVENT_ID}/votes/${voteDocId}`);
    const voteField =
      phase === "p2" ? "judgeVoteCount" : "participantVoteCount";

    try {
      await adminDb.runTransaction(async (transaction) => {
        // Read user doc inside transaction for isolation
        const userSnap = await transaction.get(userRef);
        if (userSnap.exists) {
          const userData = userSnap.data()!;
          if (userData[hasVotedField] === true) {
            throw new Error("ALREADY_VOTED");
          }
        }

        // Write vote document
        transaction.set(voteRef, {
          voterId: uid,
          selectedTeams,
          role,
          timestamp: new Date(),
          phase,
        });

        // Increment vote counts on each team
        for (const teamId of selectedTeams) {
          const teamRef = adminDb.doc(`events/${EVENT_ID}/teams/${teamId}`);
          transaction.update(teamRef, {
            [voteField]: FieldValue.increment(1),
          });
        }

        // Update user's hasVoted flags
        transaction.update(userRef, {
          [hasVotedField]: true,
          hasVoted: true,
        });
      });
    } catch (err) {
      if (err instanceof Error && err.message === "ALREADY_VOTED") {
        return NextResponse.json(
          { error: "이미 투표하셨습니다" },
          { status: 409 }
        );
      }
      throw err;
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Vote API error:", err);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
