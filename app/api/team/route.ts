import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/shared/api/firebase-admin";
import { EVENT_ID } from "@/shared/config/constants";
import type { UserRole } from "@/shared/types";

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
      uniqueCode?: string;
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

    // Only participants can update team info
    if (role !== "participant") {
      return NextResponse.json(
        { error: "팀 정보는 팀 멤버(참가자)만 수정할 수 있습니다" },
        { status: 403 }
      );
    }

    const teamId: string | null = decodedToken.teamId || null;
    const uniqueCode: string = decodedToken.uid;

    if (!teamId) {
      return NextResponse.json(
        { error: "소속된 팀이 없습니다" },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await req.json();
    const {
      nickname,
      description,
      projectUrl,
      demoUrl,
      githubUrl,
      techStack,
    }: {
      nickname?: string | null;
      description?: string;
      projectUrl?: string | null;
      demoUrl?: string | null;
      githubUrl?: string | null;
      techStack?: string[];
    } = body;

    // Validate nickname if provided
    if (nickname !== undefined && nickname !== null) {
      if (typeof nickname !== "string") {
        return NextResponse.json(
          { error: "별칭 형식이 올바르지 않습니다" },
          { status: 400 }
        );
      }
      if (nickname.trim().length > 30) {
        return NextResponse.json(
          { error: "별칭은 최대 30자까지 입력할 수 있습니다" },
          { status: 400 }
        );
      }
    }

    // Helper to validate URL fields
    const validateUrl = (url: string | null | undefined, fieldName: string) => {
      if (url !== undefined && url !== null && url !== "") {
        if (
          typeof url !== "string" ||
          (!url.startsWith("http://") && !url.startsWith("https://"))
        ) {
          return NextResponse.json(
            { error: `${fieldName}은 http:// 또는 https://로 시작해야 합니다` },
            { status: 400 }
          );
        }
      }
      return null;
    };

    // Validate projectUrl if provided
    if (projectUrl !== undefined && projectUrl !== null) {
      if (
        typeof projectUrl !== "string" ||
        (!projectUrl.startsWith("http://") &&
          !projectUrl.startsWith("https://"))
      ) {
        return NextResponse.json(
          { error: "프로젝트 URL은 http:// 또는 https://로 시작해야 합니다" },
          { status: 400 }
        );
      }
    }

    const demoUrlError = validateUrl(demoUrl, "데모 URL");
    if (demoUrlError) return demoUrlError;
    const githubUrlError = validateUrl(githubUrl, "GitHub URL");
    if (githubUrlError) return githubUrlError;

    // Validate techStack
    if (techStack !== undefined) {
      if (!Array.isArray(techStack) || techStack.some((t) => typeof t !== "string" || t.length > 30)) {
        return NextResponse.json(
          { error: "기술 스택 형식이 올바르지 않습니다" },
          { status: 400 }
        );
      }
    }

    // Verify team exists and user is a member
    const teamRef = adminDb.doc(`events/${EVENT_ID}/teams/${teamId}`);
    const teamSnap = await teamRef.get();

    if (!teamSnap.exists) {
      return NextResponse.json(
        { error: "팀을 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    const teamData = teamSnap.data()!;
    const memberUserIds: string[] = teamData.memberUserIds || [];

    if (!memberUserIds.includes(uniqueCode)) {
      return NextResponse.json(
        { error: "해당 팀의 멤버가 아닙니다" },
        { status: 403 }
      );
    }

    // Build update object with only provided fields
    const updates: Record<string, string | string[] | null> = {};
    if (nickname !== undefined) updates.nickname = nickname ? nickname.trim() : null;
    if (description !== undefined) updates.description = description;
    if (projectUrl !== undefined) updates.projectUrl = projectUrl;
    if (demoUrl !== undefined) updates.demoUrl = demoUrl || null;
    if (githubUrl !== undefined) updates.githubUrl = githubUrl || null;
    if (techStack !== undefined) updates.techStack = techStack;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "업데이트할 내용이 없습니다" },
        { status: 400 }
      );
    }

    await teamRef.update(updates);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Team API error:", err);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
