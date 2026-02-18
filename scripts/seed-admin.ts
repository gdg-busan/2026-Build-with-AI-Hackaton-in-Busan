/**
 * 초기 관리자 계정 시드 스크립트
 *
 * 사용법:
 *   npx tsx scripts/seed-admin.ts
 *
 * Firestore에 이벤트 문서 + 관리자 유저 코드를 생성합니다.
 * 생성된 코드로 /admin 페이지에 로그인할 수 있습니다.
 */

import { initializeApp, cert, type ServiceAccount } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import * as dotenv from "dotenv";
import { resolve } from "path";

// .env.local 로드
dotenv.config({ path: resolve(__dirname, "../.env.local") });

const EVENT_ID = process.env.NEXT_PUBLIC_EVENT_ID || "gdg-busan-2026";

const serviceAccount: ServiceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
};

if (!serviceAccount.projectId || !serviceAccount.clientEmail || !serviceAccount.privateKey) {
  console.error("❌ Firebase 환경변수가 설정되지 않았습니다.");
  console.error("   .env.local 파일에 FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY를 확인하세요.");
  process.exit(1);
}

const app = initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore(app);

// 관리자 코드 생성
function generateAdminCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let random = "";
  for (let i = 0; i < 4; i++) {
    random += chars[Math.floor(Math.random() * chars.length)];
  }
  return `GDG-A01${random}`;
}

async function seed() {
  const adminCode = generateAdminCode();

  console.log("🔧 이벤트 초기화 중...\n");

  // 1. 이벤트 문서 생성
  const eventRef = db.collection("events").doc(EVENT_ID);
  const eventSnap = await eventRef.get();

  if (eventSnap.exists) {
    console.log(`📋 이벤트 "${EVENT_ID}" 이미 존재합니다. 건너뜁니다.`);
  } else {
    await eventRef.set({
      status: "waiting",
      judgeWeight: 0.8,
      participantWeight: 0.2,
      maxVotesPerUser: 3,
      createdAt: new Date(),
    });
    console.log(`✅ 이벤트 "${EVENT_ID}" 생성 완료`);
  }

  // 2. 관리자 유저 생성
  const userRef = eventRef.collection("users").doc(adminCode);
  const userSnap = await userRef.get();

  if (userSnap.exists) {
    console.log("📋 관리자 유저가 이미 존재합니다.");
  } else {
    await userRef.set({
      name: "관리자",
      role: "admin",
      teamId: null,
      hasVoted: false,
      createdAt: new Date(),
    });
    console.log("✅ 관리자 유저 생성 완료");
  }

  console.log("\n" + "=".repeat(50));
  console.log("🔑 관리자 로그인 코드:");
  console.log(`\n   👉  ${adminCode}\n`);
  console.log("=".repeat(50));
  console.log("\n이 코드로 메인 페이지(/)에서 로그인하면 /admin으로 이동합니다.");
  console.log("⚠️  이 코드를 안전하게 보관하세요!\n");

  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ 시드 실패:", err);
  process.exit(1);
});
