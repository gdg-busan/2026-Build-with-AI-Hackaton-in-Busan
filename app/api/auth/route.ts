import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/shared/api/firebase-admin";
import { EVENT_ID } from "@/shared/config/constants";

export async function POST(req: NextRequest) {
  try {
    const { code } = await req.json();

    if (!code || typeof code !== "string") {
      return NextResponse.json({ error: "코드를 입력해주세요" }, { status: 400 });
    }

    const normalizedCode = code.trim().toUpperCase();

    const userDoc = await adminDb
      .collection("events")
      .doc(EVENT_ID)
      .collection("users")
      .doc(normalizedCode)
      .get();

    if (!userDoc.exists) {
      return NextResponse.json({ error: "유효하지 않은 코드입니다" }, { status: 401 });
    }

    const userData = userDoc.data()!;

    const token = await adminAuth.createCustomToken(normalizedCode, {
      uniqueCode: normalizedCode,
      name: userData.name,
      role: userData.role,
      teamId: userData.teamId ?? null,
    });

    return NextResponse.json({ token });
  } catch (error) {
    console.error("Auth error:", error);
    return NextResponse.json({ error: "서버 오류가 발생했습니다" }, { status: 500 });
  }
}
