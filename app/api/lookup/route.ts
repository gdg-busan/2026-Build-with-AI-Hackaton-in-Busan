import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/shared/api/firebase-admin";
import { EVENT_ID } from "@/shared/config/constants";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "이메일을 입력해주세요" }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const usersRef = adminDb
      .collection("events")
      .doc(EVENT_ID)
      .collection("users");

    const snapshot = await usersRef.where("email", "==", normalizedEmail).limit(1).get();

    if (snapshot.empty) {
      return NextResponse.json(
        { error: "등록된 이메일이 없습니다. 예매 시 사용한 이메일을 확인해주세요." },
        { status: 404 }
      );
    }

    const doc = snapshot.docs[0];
    const data = doc.data();

    return NextResponse.json({
      code: doc.id,
      name: data.name,
    });
  } catch (error) {
    console.error("Lookup error:", error);
    return NextResponse.json({ error: "서버 오류가 발생했습니다" }, { status: 500 });
  }
}
