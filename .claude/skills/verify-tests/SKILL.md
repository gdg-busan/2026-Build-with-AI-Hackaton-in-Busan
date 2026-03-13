---
name: verify-tests
description: Vitest 단위/통합 테스트 실행 + 빌드 + 린트 + 타입체크 종합 검증. 코드 수정 후 테스트가 깨지지 않았는지 확인하거나, 배포 전 전체 품질 게이트를 통과하는지 검증할 때 사용. "테스트 돌려줘", "빌드 확인", "타입 에러 확인", "전체 검증" 등의 요청에도 사용.
---

## Purpose

프로젝트의 품질 게이트를 종합적으로 검증합니다:

1. **Vitest 단위/통합 테스트** — scoring 로직, API 보안, 동시성, 데이터 무결성, 라우트 핸들러
2. **TypeScript 타입 체크** — 컴파일 에러 없이 타입이 정합한지 확인
3. **ESLint 린트** — 코드 스타일 및 잠재 버그 검출
4. **Next.js 빌드** — 프로덕션 빌드가 성공하는지 확인

각 단계는 독립적이므로, 가능하면 병렬로 실행하여 속도를 높입니다.

## When to Run

- 코드 수정 후 테스트가 깨지지 않았는지 확인할 때
- PR 생성 전 전체 품질 게이트 통과 확인
- 배포 전 최종 검증
- 리팩토링이나 의존성 업데이트 후

## Test Files Overview

| 테스트 파일 | 검증 대상 | 핵심 시나리오 |
|------------|----------|-------------|
| `src/shared/__tests__/scoring.test.ts` | 점수 계산/정규화/순위 | calculateScores, getTop10, getPhase1Results, detectFinalTies, applyFinalRankingOverrides |
| `src/shared/__tests__/api-security.test.ts` | API 보안 | 인증 우회, 권한 상승, phase/role 검증, 자기팀 투표 차단, 중복 방지 |
| `src/shared/__tests__/route-handlers.test.ts` | API 라우트 핸들러 | Auth/Vote/Admin/User/Team/Cheer/Feedback/Lookup 전체 라우트 |
| `src/shared/__tests__/concurrency.test.ts` | 동시성/경쟁 조건 | 이중 투표, 다중 사용자 동시 투표, 상태 변경 경쟁 |
| `src/shared/__tests__/data-integrity.test.ts` | 데이터 무결성 | 투표 수 일관성, hasVoted 플래그, 리셋 후 상태, 상태 전이 |
| `src/shared/__tests__/env.test.ts` | 환경 설정 | .env.local 키 존재 여부, FIREBASE_PRIVATE_KEY 형식 |

## Workflow

### Step 1: Vitest 단위/통합 테스트 실행

Vitest를 실행하여 모든 테스트 파일의 통과 여부를 확인합니다.

```bash
pnpm test -- --run --reporter=verbose 2>&1
```

**결과 분석:**
- 전체 테스트 수, 통과/실패/스킵 수를 파싱
- 실패한 테스트가 있으면 실패 메시지와 위치를 수집

**PASS:** 모든 테스트가 통과 (0 failed).
**FAIL:** 실패한 테스트가 존재 → 실패 원인과 파일:라인 정보를 보고.

> **참고:** `env.test.ts`는 `.env.local` 파일에 의존하므로, CI 환경이나 `.env.local`이 없는 환경에서는 실패할 수 있습니다. 이 경우 해당 테스트만 별도 표기합니다.

### Step 2: TypeScript 타입 체크

```bash
npx tsc --noEmit 2>&1
```

**PASS:** 출력 없음 (타입 에러 0개).
**FAIL:** 타입 에러 발견 → 에러 메시지와 파일:라인 정보를 보고.

### Step 3: ESLint 린트

```bash
pnpm lint 2>&1
```

**PASS:** 에러 0개.
**FAIL:** 린트 에러 발견 → 규칙 위반 내용을 보고. (warning은 PASS로 취급)

### Step 4: Next.js 프로덕션 빌드

```bash
pnpm build 2>&1
```

빌드는 시간이 걸리므로, 빠른 검증만 필요한 경우 Step 1~3만 실행하고 사용자에게 빌드 실행 여부를 확인합니다.

**PASS:** 빌드 성공 (`✓ Compiled successfully`).
**FAIL:** 빌드 에러 발견 → 에러 메시지를 보고.

## Execution Strategy

**빠른 검증 (기본):** Step 1 ~ Step 3을 병렬 실행. 대부분의 코드 변경 후에 충분.
**전체 검증 (배포 전):** Step 1 ~ Step 4 모두 실행. 사용자가 "전체 검증", "배포 전 확인" 등을 요청한 경우.

병렬 실행 시 Vitest, tsc, lint를 동시에 돌리고 결과를 종합합니다.

## Output Format

```markdown
## 테스트 검증 결과

### Vitest: X/Y PASS (Z skipped)
| 테스트 스위트 | 결과 | 상세 |
|-------------|------|------|
| scoring | PASS | 15/15 통과 |
| api-security | PASS | 10/10 통과 |
| route-handlers | PASS | 18/18 통과 |
| concurrency | PASS | 6/6 통과 |
| data-integrity | PASS | 12/12 통과 |
| env | SKIP | .env.local 미존재 |

### TypeScript: PASS / FAIL
에러 0개 (또는 에러 목록)

### ESLint: PASS / FAIL
에러 0개 (또는 에러 목록)

### Build: PASS / FAIL / SKIPPED
빌드 성공 (또는 에러 메시지)

### 종합: PASS / FAIL (N개 이슈)
```

## Exceptions

1. `env.test.ts`는 `.env.local` 파일 존재를 전제하므로, 파일이 없는 환경에서는 자동 스킵 처리
2. E2E 테스트(`e2e/` 디렉토리)는 이 스킬의 범위에 포함되지 않음 — 별도의 `playwright-cli` 스킬이나 직접 `npx playwright test` 실행 필요
3. 빌드 단계는 시간이 오래 걸릴 수 있으므로, 사용자가 빠른 검증을 원하면 생략 가능
