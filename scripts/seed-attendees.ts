/**
 * 예매자 엑셀 파일에서 참가자를 시드하는 스크립트
 *
 * 사용법:
 *   npx tsx scripts/seed-attendees.ts <엑셀파일경로>
 *
 * 엑셀에서 예매 상태인 참가자만 추출하여 Firestore에 유저+팀을 생성하고,
 * 이메일 → 참가코드 매핑을 저장합니다.
 * 같은 팀으로 지원한 참가자는 같은 팀으로 배정됩니다.
 */

import { initializeApp, cert, type ServiceAccount } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import * as dotenv from "dotenv";
import { resolve } from "path";
import { execSync } from "child_process";
import { existsSync } from "fs";

dotenv.config({ path: resolve(__dirname, "../.env.local") });

const EVENT_ID = process.env.NEXT_PUBLIC_EVENT_ID || "gdg-busan-2026";

const TEAM_EMOJIS = [
  "🚀", "🤖", "🎮", "🧠", "💡", "🔥", "⚡", "🎯",
  "🌟", "🎨", "🛸", "🧬", "🔮", "🎪", "🏆", "🦾",
  "🌈", "🎸", "🍕", "🦄", "🐙", "🌊", "🏔️", "🎭", "🧪",
];

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

// 참가자 코드 생성
function generateParticipantCode(index: number): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let random = "";
  for (let i = 0; i < 4; i++) {
    random += chars[Math.floor(Math.random() * chars.length)];
  }
  return `GDG-P${String(index).padStart(2, "0")}${random}`;
}

interface Attendee {
  name: string;
  email: string;
  phone: string;
  ticketType: string;
  status: string;
  teamInfo: string;
  participationType: string;
}

const RANDOM_TEAM_ADJECTIVES = [
  "용감한", "빛나는", "거침없는", "창의적인", "대담한",
  "열정의", "무한한", "신비로운", "즐거운", "멋진",
  "화려한", "눈부신", "놀라운", "도전하는", "빠른",
  "강력한", "영리한", "자유로운", "끈질긴", "유쾌한",
  "날카로운", "당당한", "든든한", "기막힌", "호기로운",
  "찬란한", "뜨거운", "묵직한", "기발한", "과감한",
  "활기찬", "우아한", "젊은", "따뜻한", "시원한",
  "매서운", "산뜻한", "다정한", "씩씩한", "지혜로운",
];

const RANDOM_TEAM_NOUNS = [
  "해커", "코더", "드리머", "빌더", "러너",
  "메이커", "파이터", "플레이어", "크리에이터", "이노베이터",
  "탐험가", "개발자", "챌린저", "파이어니어", "마스터",
  "항해사", "발명가", "사냥꾼", "수호자", "전사",
  "연금술사", "조종사", "설계자", "개척자", "모험가",
  "관찰자", "사색가", "예술가", "과학자", "전략가",
  "몽상가", "여행자", "기사단", "돌격대", "유격대",
  "특공대", "선봉대", "정찰대", "결사대", "돌풍",
];

const INVALID_TEAM_NAME_RE = /^[-–—_.,/\\]+$/;

/** Simple string hash → stable unsigned 32-bit integer */
function stableHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h >>> 0; // unsigned
}

const usedPlaceholderNames = new Set<string>();

/** Deterministic placeholder name derived from the attendee's email.
 *  Appends a numeric suffix on collision so each solo attendee gets their own team. */
function generateDeterministicTeamName(email: string): string {
  const h = stableHash(email.toLowerCase());
  const adj = RANDOM_TEAM_ADJECTIVES[h % RANDOM_TEAM_ADJECTIVES.length];
  const noun = RANDOM_TEAM_NOUNS[(h >>> 16) % RANDOM_TEAM_NOUNS.length];
  let name = `${adj} ${noun}`;
  let suffix = 2;
  while (usedPlaceholderNames.has(name)) {
    name = `${adj} ${noun} ${suffix}`;
    suffix++;
  }
  usedPlaceholderNames.add(name);
  return name;
}

function isInvalidTeamName(name: string, attendeeName?: string): boolean {
  if (!name) return true;
  const trimmed = name.trim();
  if (!trimmed) return true;
  if (INVALID_TEAM_NAME_RE.test(trimmed)) return true;
  if (attendeeName && trimmed === attendeeName.trim()) return true;
  return false;
}

function validNameOrDeterministic(candidate: string, attendeeName: string, email: string): string {
  return isInvalidTeamName(candidate, attendeeName) ? generateDeterministicTeamName(email) : candidate;
}

/**
 * 팀 정보 문자열에서 팀명을 추출
 * 패턴:
 *   "대표팀원: 손수호, 팀명: 이겨야한다딸깍딸깍"  → 이겨야한다딸깍딸깍
 *   "대표팀원 이름: 송녕경, 팀명: 나에겐"          → 나에겐
 *   "송녕경, 나에겐"                               → 나에겐
 *   "박시연, 꾸루룩팀"                              → 꾸루룩팀
 *   "임예영 / 프루브"                               → 프루브
 *   "밥값은하자"                                    → 밥값은하자
 *   ""  / "-" / 공백 / 본인이름만               → 임의 팀명 생성
 */
function extractTeamName(teamInfo: string, attendeeName: string, email: string): string {
  if (isInvalidTeamName(teamInfo, attendeeName)) return generateDeterministicTeamName(email);

  // "팀명: XXX" 패턴
  const teamNameMatch = teamInfo.match(/팀명\s*[:：]\s*(.+)/);
  if (teamNameMatch) return validNameOrDeterministic(teamNameMatch[1].trim(), attendeeName, email);

  // "이름 / 팀명" 패턴
  if (teamInfo.includes("/")) {
    const parts = teamInfo.split("/");
    return validNameOrDeterministic(parts[parts.length - 1].trim(), attendeeName, email);
  }

  // "이름, 팀명" 패턴 (대표팀원: 이 없는 경우)
  if (teamInfo.includes(",") && !teamInfo.includes("대표팀원")) {
    const parts = teamInfo.split(",");
    return validNameOrDeterministic(parts[parts.length - 1].trim(), attendeeName, email);
  }

  // 단일 문자열
  return validNameOrDeterministic(teamInfo.trim(), attendeeName, email);
}

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        fields.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
  }
  fields.push(current);
  return fields;
}

function parseExcel(filePath: string): Attendee[] {
  const csv = execSync(`npx --yes xlsx-cli "${filePath}"`, { encoding: "utf-8" });
  const lines = csv.split("\n").filter((l) => l.trim());

  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]);

  const colIndex = (name: string) => headers.findIndex((h) => h.includes(name));
  const iBookerName = colIndex("예매자 이름");
  const iBookerPhone = colIndex("예매자 전화번호");
  const iBookerEmail = colIndex("예매자 이메일");
  const iPartName = colIndex("참가자 이름");
  const iPartPhone = colIndex("참가자 전화번호");
  const iPartEmail = colIndex("참가자 이메일");
  const iTicket = colIndex("티켓 이름");
  const iStatus = colIndex("상태");
  const iParticipationType = colIndex("참여 형태");
  const iTeamInfo = colIndex("대표팀원");

  return lines.slice(1).map((line) => {
    const cols = parseCSVLine(line);
    const get = (i: number) => (i >= 0 ? cols[i]?.trim() || "" : "");

    const participantEmail = get(iPartEmail) && get(iPartEmail) !== "-"
      ? get(iPartEmail) : get(iBookerEmail);
    const participantName = get(iPartName) && get(iPartName) !== "-"
      ? get(iPartName) : get(iBookerName);
    const participantPhone = get(iPartPhone) && get(iPartPhone) !== "-"
      ? get(iPartPhone) : get(iBookerPhone);

    return {
      name: participantName,
      email: participantEmail.toLowerCase(),
      phone: participantPhone,
      ticketType: get(iTicket),
      status: get(iStatus),
      teamInfo: get(iTeamInfo),
      participationType: get(iParticipationType),
    };
  });
}

async function seed() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("❌ 사용법: npx tsx scripts/seed-attendees.ts <엑셀파일경로>");
    process.exit(1);
  }

  const resolvedPath = resolve(filePath);

  if (!existsSync(resolvedPath)) {
    console.error(`❌ 파일을 찾을 수 없습니다: ${resolvedPath}`);
    process.exit(1);
  }

  console.log(`📂 엑셀 파일 읽는 중: ${resolvedPath}\n`);

  const attendees = parseExcel(resolvedPath);

  // 취소된 예매 제외, Facilitator 제외
  const activeAttendees = attendees.filter((a) => {
    if (a.status === "취소") return false;
    if (a.ticketType === "Facilitator") return false;
    if (!a.email) return false;
    return true;
  });

  console.log(`📊 전체 ${attendees.length}명 중 유효 참가자: ${activeAttendees.length}명\n`);

  // ─── 1. 팀 그룹핑 ───
  // 팀명 → 참가자 목록
  const teamGroups = new Map<string, Attendee[]>();
  for (const attendee of activeAttendees) {
    const teamName = extractTeamName(attendee.teamInfo, attendee.name, attendee.email);
    const existing = teamGroups.get(teamName) || [];
    existing.push(attendee);
    teamGroups.set(teamName, existing);
  }

  console.log(`🏠 팀 ${teamGroups.size}개 감지:\n`);
  for (const [teamName, members] of teamGroups) {
    const memberNames = members.map((m) => m.name).join(", ");
    console.log(`  📌 ${teamName} (${members.length}명): ${memberNames}`);
  }
  console.log("");

  const eventRef = db.collection("events").doc(EVENT_ID);
  const usersRef = eventRef.collection("users");
  const teamsRef = eventRef.collection("teams");

  // ─── 2. 기존 데이터 확인 ───
  const existingUsers = await usersRef.get();
  const existingEmails = new Map<string, string>();
  existingUsers.forEach((doc) => {
    const data = doc.data();
    if (data.email) {
      existingEmails.set(data.email.toLowerCase(), doc.id);
    }
  });

  const existingTeams = await teamsRef.get();
  const existingTeamNames = new Map<string, string>();
  existingTeams.forEach((doc) => {
    existingTeamNames.set(doc.data().name, doc.id);
  });

  let nextUserIndex = existingUsers.size + 1;
  let nextTeamIndex = existingTeams.size + 1;

  let usersCreated = 0;
  let usersSkipped = 0;
  let teamsCreated = 0;

  const results: { name: string; email: string; code: string; teamName: string; teamId: string }[] = [];

  // ─── 3. 팀 + 유저 생성 (batched) ───
  const MAX_BATCH_SIZE = 500;
  let batch = db.batch();
  let batchCount = 0;

  const flushBatch = async () => {
    if (batchCount > 0) {
      await batch.commit();
      batch = db.batch();
      batchCount = 0;
    }
  };

  const addToBatch = async () => {
    batchCount++;
    if (batchCount >= MAX_BATCH_SIZE) {
      await flushBatch();
    }
  };

  for (const [teamName, members] of teamGroups) {
    // 팀 생성 또는 기존 팀 찾기
    let teamId = existingTeamNames.get(teamName);
    if (!teamId) {
      teamId = `team-${String(nextTeamIndex).padStart(2, "0")}`;
      nextTeamIndex++;

      const emoji = TEAM_EMOJIS[(teamsCreated + existingTeams.size) % TEAM_EMOJIS.length];

      batch.set(teamsRef.doc(teamId), {
        name: teamName,
        nickname: null,
        description: "",
        emoji,
        projectUrl: null,
        memberUserIds: [],
        judgeVoteCount: 0,
        participantVoteCount: 0,
        cheerCount: 0,
        isHidden: false,
        createdAt: new Date(),
      });
      await addToBatch();

      existingTeamNames.set(teamName, teamId);
      teamsCreated++;
      console.log(`🏠 팀 생성: ${teamName} → ${teamId}`);
    }

    // 멤버 유저 생성
    const memberCodes: string[] = [];

    for (const attendee of members) {
      let code: string;

      if (existingEmails.has(attendee.email)) {
        code = existingEmails.get(attendee.email)!;
        // 기존 유저의 teamId 업데이트
        batch.update(usersRef.doc(code), { teamId });
        await addToBatch();
        console.log(`⏭️  이미 등록됨 (팀 업데이트): ${attendee.name} → ${code} (${teamName})`);
        usersSkipped++;
      } else {
        code = generateParticipantCode(nextUserIndex);
        nextUserIndex++;

        batch.set(usersRef.doc(code), {
          name: attendee.name,
          role: "participant",
          teamId,
          hasVoted: false,
          email: attendee.email,
          phone: attendee.phone,
          teamInfo: attendee.teamInfo || null,
          participationType: attendee.participationType || null,
          createdAt: new Date(),
        });
        await addToBatch();

        existingEmails.set(attendee.email, code);
        usersCreated++;
        console.log(`✅ 생성: ${attendee.name} (${attendee.email}) → ${code} [${teamName}]`);
      }

      memberCodes.push(code);
      results.push({ name: attendee.name, email: attendee.email, code, teamName, teamId });
    }

    // 팀의 memberUserIds 업데이트
    batch.update(teamsRef.doc(teamId), { memberUserIds: memberCodes });
    await addToBatch();
  }

  // Flush remaining writes
  await flushBatch();

  // ─── 4. 결과 출력 ───
  console.log("\n" + "=".repeat(70));
  console.log(`📊 결과: 유저 생성 ${usersCreated}명 / 스킵 ${usersSkipped}명 / 팀 생성 ${teamsCreated}개`);
  console.log("=".repeat(70));

  console.log("\n📋 전체 매핑 목록:\n");
  console.log("이름".padEnd(10) + "이메일".padEnd(35) + "코드".padEnd(14) + "팀");
  console.log("-".repeat(70));
  for (const r of results) {
    console.log(`${r.name.padEnd(10)} ${r.email.padEnd(35)} ${r.code.padEnd(14)} ${r.teamName}`);
  }

  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ 시드 실패:", err);
  process.exit(1);
});
