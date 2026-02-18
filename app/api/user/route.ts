import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { EVENT_ID } from "@/lib/constants";
import type { UserRole } from "@/lib/types";

export async function PUT(req: NextRequest) {
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
    if (role !== "participant" && role !== "judge") {
      return NextResponse.json(
        { error: "프로필 수정 권한이 없습니다" },
        { status: 403 }
      );
    }

    const uniqueCode: string = decodedToken.uid;

    const body = await req.json();
    const { name, bio }: { name?: string; bio?: string | null } = body;

    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length === 0) {
        return NextResponse.json(
          { error: "이름을 입력해주세요" },
          { status: 400 }
        );
      }
      if (name.trim().length > 20) {
        return NextResponse.json(
          { error: "이름은 최대 20자까지 입력할 수 있습니다" },
          { status: 400 }
        );
      }
    }

    if (bio !== undefined && bio !== null) {
      if (typeof bio !== "string") {
        return NextResponse.json(
          { error: "소개 형식이 올바르지 않습니다" },
          { status: 400 }
        );
      }
      if (bio.trim().length > 100) {
        return NextResponse.json(
          { error: "소개는 최대 100자까지 입력할 수 있습니다" },
          { status: 400 }
        );
      }
    }

    const userRef = adminDb.doc(`events/${EVENT_ID}/users/${uniqueCode}`);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return NextResponse.json(
        { error: "사용자를 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    const updates: Record<string, string | null> = {};
    if (name !== undefined) updates.name = name.trim();
    if (bio !== undefined) updates.bio = bio ? bio.trim() : null;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "업데이트할 내용이 없습니다" },
        { status: 400 }
      );
    }

    await userRef.update(updates);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("User API error:", err);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
