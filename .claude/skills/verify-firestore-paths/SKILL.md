---
name: verify-firestore-paths
description: Firestore 경로 일관성 검증. Firestore 접근 코드 수정 후 사용.
---

## Purpose

1. 모든 Firestore 접근이 `events/{EVENT_ID}/` 하위 경로를 사용하는지 확인
2. 클라이언트(getFirebaseDb)와 서버(adminDb) 모두 동일한 경로 구조를 사용하는지 확인
3. Firebase 클라이언트 SDK에서 Proxy 대신 getter 함수를 사용하는지 확인

## When to Run

- Firestore 접근 코드를 추가하거나 수정한 후
- 새 페이지나 API 라우트에서 Firestore를 사용하는 코드를 작성한 후
- `lib/firebase.ts` 또는 `lib/firestore-helpers.ts`를 수정한 후

## Related Files

| File | Purpose |
|------|---------|
| `lib/firebase.ts` | 클라이언트 Firebase SDK (getFirebaseDb, getFirebaseAuth) |
| `lib/firebase-admin.ts` | Admin SDK (adminDb, adminAuth) |
| `lib/firestore-helpers.ts` | Firestore 참조 헬퍼 (getEventRef, getTeamsRef 등) |
| `lib/constants.ts` | EVENT_ID 상수 |
| `app/api/admin/route.ts` | Admin API (서버사이드 Firestore 접근) |
| `app/api/vote/route.ts` | Vote API (서버사이드 Firestore 접근) |
| `app/vote/page.tsx` | 투표 페이지 (클라이언트 Firestore 구독) |
| `app/admin/page.tsx` | 관리자 페이지 (클라이언트 Firestore 구독) |
| `app/display/page.tsx` | 프로젝터 뷰 (클라이언트 Firestore 구독) |
| `app/results/page.tsx` | 결과 페이지 (클라이언트 Firestore 구독) |

## Workflow

### Step 1: 클라이언트에서 Proxy 대신 getter 함수 사용 확인

**검사:** `import { db }` 또는 `import { auth }` 형태의 직접 값 import가 없어야 함.

```bash
grep -rn "import.*{ db\b\|import.*{ auth\b" --include="*.tsx" --include="*.ts" app/ lib/ components/
```

**PASS:** 결과 없음 (모두 `getFirebaseDb()`, `getFirebaseAuth()` 사용).
**FAIL:** 직접 값 import 발견 → `getFirebaseDb()` / `getFirebaseAuth()` 함수 호출로 변경 필요. Firebase SDK의 `doc()`, `collection()` 등은 Proxy 객체의 `instanceof` 체크를 통과하지 못함.

### Step 2: 클라이언트 Firestore 접근이 EVENT_ID 경로 사용 확인

**검사:** 클라이언트의 모든 `doc()`, `collection()` 호출이 `"events", EVENT_ID` 경로를 포함해야 함.

```bash
grep -n "doc(getFirebaseDb\|collection(getFirebaseDb" app/*.tsx app/**/*.tsx
```

**PASS:** 모든 호출이 `"events", EVENT_ID` 경로를 포함.
**FAIL:** `events/{EVENT_ID}` 없이 직접 최상위 컬렉션 접근 → 경로 수정 필요.

### Step 3: 서버 Firestore 접근이 EVENT_ID 경로 사용 확인

**검사:** API 라우트의 `adminDb` 접근이 `events/${EVENT_ID}` 또는 `events").doc(EVENT_ID)` 경로를 포함해야 함.

```bash
grep -n "adminDb\." app/api/*/route.ts
```

**PASS:** 모든 `adminDb` 접근이 `events/{EVENT_ID}` 하위 경로 사용.
**FAIL:** 최상위 컬렉션에 직접 접근하는 코드 발견 → `events/{EVENT_ID}/` prefix 추가 필요.

### Step 4: EVENT_ID import 일관성

**검사:** Firestore 경로에 하드코딩된 이벤트 ID가 없어야 함.

```bash
grep -rn "gdg-busan-2026" --include="*.ts" --include="*.tsx" app/ lib/
```

**PASS:** 결과 없음 (모두 `EVENT_ID` 상수 사용).
**FAIL:** 하드코딩된 이벤트 ID 발견 → `EVENT_ID` 상수로 교체 필요.

## Output Format

| 검사 | 결과 | 상세 |
|------|------|------|
| Getter 함수 사용 | PASS/FAIL | 세부 내용 |
| 클라이언트 경로 | PASS/FAIL | 세부 내용 |
| 서버 경로 | PASS/FAIL | 세부 내용 |
| EVENT_ID 일관성 | PASS/FAIL | 세부 내용 |

## Exceptions

1. `lib/constants.ts`에서 `EVENT_ID`의 기본값으로 `"gdg-busan-2026"` 하드코딩은 정상 (환경변수 fallback)
2. `scripts/seed-admin.ts`는 독립 실행 스크립트이므로 자체 Firebase 초기화 사용이 정상
3. `lib/firebase-admin.ts`는 서버 전용이므로 Proxy 패턴이 아닌 일반 함수 export도 허용
