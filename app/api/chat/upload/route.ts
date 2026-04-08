import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { adminAuth, adminDb } from "@/shared/api/firebase-admin";
import { getAdminStorage } from "@/shared/api/firebase-admin";
import { EVENT_ID } from "@/shared/config/constants";
import type { UserRole } from "@/shared/types";

const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];

export async function POST(req: NextRequest) {
  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "인증 토큰이 필요합니다" },
        { status: 401 }
      );
    }

    let decodedToken: { uid: string; role?: UserRole; teamId?: string | null };
    try {
      decodedToken = await adminAuth.verifyIdToken(authHeader.slice(7));
    } catch {
      return NextResponse.json(
        { error: "유효하지 않은 인증 토큰입니다" },
        { status: 401 }
      );
    }

    const role: UserRole = (decodedToken.role as UserRole) || "participant";
    const teamId: string | null = decodedToken.teamId || null;

    const formData = await req.formData();
    const file = formData.get("image") as File | null;
    const roomId = formData.get("roomId") as string | null;

    if (!file || !roomId) {
      return NextResponse.json(
        { error: "이미지와 채팅방 ID가 필요합니다" },
        { status: 400 }
      );
    }

    // Verify room exists and user has access
    const roomRef = adminDb.doc(`events/${EVENT_ID}/chatRooms/${roomId}`);
    const roomSnap = await roomRef.get();
    if (!roomSnap.exists) {
      return NextResponse.json(
        { error: "채팅방을 찾을 수 없습니다" },
        { status: 404 }
      );
    }
    const roomData = roomSnap.data()!;
    if (roomData.type === "team" && role !== "admin") {
      if (!teamId || teamId !== roomData.teamId) {
        return NextResponse.json(
          { error: "해당 채팅방에 접근할 수 없습니다" },
          { status: 403 }
        );
      }
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "PNG, JPEG, GIF, WebP 이미지만 업로드 가능합니다" },
        { status: 400 }
      );
    }

    if (file.size > MAX_IMAGE_SIZE) {
      return NextResponse.json(
        { error: "이미지는 2MB 이하만 업로드 가능합니다" },
        { status: 400 }
      );
    }

    const ext = file.name.split(".").pop() || "png";
    const filePath = `chat/${EVENT_ID}/${roomId}/${Date.now()}_${decodedToken.uid}.${ext}`;

    const bucket = getAdminStorage().bucket();
    const fileRef = bucket.file(filePath);

    const downloadToken = randomUUID();
    const buffer = Buffer.from(await file.arrayBuffer());
    await fileRef.save(buffer, {
      metadata: {
        contentType: file.type,
        metadata: {
          firebaseStorageDownloadTokens: downloadToken,
        },
      },
    });

    // Build Firebase Storage download URL with token
    const bucketName = bucket.name;
    const encodedPath = encodeURIComponent(filePath);
    const imageUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodedPath}?alt=media&token=${downloadToken}`;

    return NextResponse.json({ success: true, imageUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    console.error("Chat upload API error:", message, err);
    return NextResponse.json(
      { error: `이미지 업로드 실패: ${message}` },
      { status: 500 }
    );
  }
}
