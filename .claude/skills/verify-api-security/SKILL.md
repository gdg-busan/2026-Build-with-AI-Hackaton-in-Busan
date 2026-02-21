---
name: verify-api-security
description: API 라우트 보안 패턴 검증. API 라우트 추가/수정 후 사용.
---

## Purpose

1. 모든 보호된 API 라우트가 Firebase ID 토큰을 검증하는지 확인
2. Admin 전용 API가 role 체크를 수행하는지 확인
3. 투표 API가 부정 방지 로직(자기 팀 제외, 중복 투표 방지)을 포함하는지 확인
4. 투표 API가 Phase-aware 역할 검증(P1=participant, P2=judge)을 수행하는지 확인
5. Admin API의 새 action들이 입력 검증을 포함하는지 확인

## When to Run

- `app/api/` 하위 라우트 파일을 추가하거나 수정한 후
- 인증/인가 로직을 변경한 후
- Firestore security rules를 수정한 후

## Related Files

| File | Purpose |
|------|---------|
| `app/api/auth/route.ts` | 코드 인증 → Custom Token 발급 (공개 엔드포인트) |
| `app/api/vote/route.ts` | 투표 제출 (인증 필요, 부정 방지) |
| `app/api/admin/route.ts` | 관리자 CRUD 작업 (admin role 필요) |
| `app/api/team/route.ts` | 팀 정보 조회/수정 (인증 필요) |
| `app/api/user/route.ts` | 사용자 프로필 조회/수정 (인증 필요) |
| `app/api/cheer/route.ts` | 팀 응원 리액션 (인증 필요) |
| `app/api/feedback/route.ts` | 익명 피드백 제출/조회 (인증 필요) |
| `app/api/chat/rooms/route.ts` | 채팅방 목록 조회 (인증 필요) |
| `app/api/chat/send/route.ts` | 채팅 메시지 전송 (인증 필요) |
| `firebase/firestore.rules` | Firestore 보안 규칙 |
| `lib/firebase-admin.ts` | Admin SDK (verifyIdToken, adminDb) |

## Workflow

### Step 1: 보호된 API에 토큰 검증 존재 확인

**검사:** 모든 보호된 API 라우트에 `verifyIdToken` 호출이 있어야 함.

```bash
grep -rn "verifyIdToken" app/api/vote/route.ts app/api/admin/route.ts app/api/team/route.ts app/api/user/route.ts app/api/cheer/route.ts app/api/feedback/route.ts app/api/chat/rooms/route.ts app/api/chat/send/route.ts
```

**PASS:** 모든 보호된 API 파일에서 `verifyIdToken` 호출이 발견됨.
**FAIL:** 어느 한 파일에서 `verifyIdToken`이 누락됨 → 토큰 검증 추가 필요.

### Step 2: Admin API role 체크 확인

**검사:** `/api/admin/route.ts`에서 admin role을 확인해야 함.

```bash
grep -n "role.*admin\|admin.*role" app/api/admin/route.ts
```

**PASS:** admin role 체크 로직이 존재함.
**FAIL:** role 체크 누락 → 비인가 사용자가 admin 작업 가능.

### Step 3: 투표 API 자기 팀 제외 검증

**검사:** `/api/vote/route.ts`에서 자기 팀 투표를 차단해야 함.

```bash
grep -n "teamId\|own.*team\|self.*vote\|자기.*팀" app/api/vote/route.ts
```

**PASS:** teamId 기반 자기 팀 체크 로직 존재.
**FAIL:** 자기 팀 투표 차단 로직 누락.

### Step 4: Authorization 헤더 파싱 패턴 일관성

**검사:** 보호된 API들이 동일한 패턴으로 Bearer 토큰을 추출해야 함.

```bash
grep -rn "Bearer\|Authorization" app/api/vote/route.ts app/api/admin/route.ts app/api/team/route.ts app/api/user/route.ts app/api/cheer/route.ts app/api/feedback/route.ts app/api/chat/rooms/route.ts app/api/chat/send/route.ts
```

**PASS:** 모든 파일이 `Authorization: Bearer <token>` 패턴 사용.
**FAIL:** 불일치하는 토큰 추출 패턴.

### Step 5: Firestore Rules에 votes 보호 확인

**검사:** votes 컬렉션에 1인 1문서 제한이 있어야 함.

```bash
grep -n "votes\|exists\|request.auth.uid" firebase/firestore.rules
```

**PASS:** votes 문서 ID = auth UID 강제 및 exists 체크 존재.
**FAIL:** votes 보안 규칙 누락.

### Step 6: Phase-aware 역할 검증 확인

**검사:** 투표 API에서 P1은 participant만, P2는 judge만 투표 가능해야 함.

```bash
grep -n "phase.*p1.*participant\|phase.*p2.*judge\|role.*participant\|role.*judge" app/api/vote/route.ts
```

**PASS:** P1=participant, P2=judge 역할 검증 로직이 존재.
**FAIL:** phase별 역할 검증 누락 → 비인가 역할이 해당 phase에서 투표 가능.

### Step 7: Phase-specific 중복 투표 방지 확인

**검사:** 투표 API에서 `hasVotedP1`/`hasVotedP2` 각각을 체크해야 함.

```bash
grep -n "hasVotedP1\|hasVotedP2" app/api/vote/route.ts
```

**PASS:** phase별 hasVoted 플래그 체크가 존재.
**FAIL:** phase별 중복 투표 방지 누락 → P1에서 투표한 사용자가 P1에 재투표 가능.

### Step 8: Admin API 새 action 입력 검증 확인

**검사:** `resolveFinalTies`, `finalizePhase1`, `resolvePhase1Ties` action들이 입력 검증을 수행해야 함.

```bash
grep -n "resolveFinalTies\|finalizePhase1\|resolvePhase1Ties" app/api/admin/route.ts
```

**PASS:** 모든 새 action에서 입력 배열 검증 및 팀 존재 확인 로직이 존재.
**FAIL:** 입력 검증 누락 → 잘못된 teamId로 데이터 오염 가능.

### Step 9: revealed_final 전환 시 동점 차단 확인

**검사:** `revealed_final` 상태 전환 시 동점이 있으면 `finalRankingOverrides` 없이 차단되어야 함.

```bash
grep -n "revealed_final\|finalRankingOverrides\|detectFinalTies" app/api/admin/route.ts
```

**PASS:** 동점 존재 + overrides 미설정 시 400 에러 반환.
**FAIL:** 동점 미해결 상태로 결과 공개 가능 → 임의 순위 노출.

## Output Format

| 검사 | 결과 | 상세 |
|------|------|------|
| 토큰 검증 | PASS/FAIL | 세부 내용 |
| Admin role 체크 | PASS/FAIL | 세부 내용 |
| 자기 팀 제외 | PASS/FAIL | 세부 내용 |
| Bearer 패턴 | PASS/FAIL | 세부 내용 |
| Firestore Rules | PASS/FAIL | 세부 내용 |
| Phase-aware 역할 검증 | PASS/FAIL | 세부 내용 |
| Phase-specific 중복 방지 | PASS/FAIL | 세부 내용 |
| Admin 새 action 입력 검증 | PASS/FAIL | 세부 내용 |
| 동점 차단 | PASS/FAIL | 세부 내용 |

## Exceptions

1. `/api/auth/route.ts`는 공개 엔드포인트이므로 토큰 검증 불필요 (코드 기반 인증 수행)
2. Firestore Rules의 read 권한은 인증된 모든 사용자에게 열려있는 것이 정상 (실시간 구독 필요)
3. 개발/테스트 환경에서 임시로 보안 체크를 주석 처리한 경우는 커밋 전 복원 필요
