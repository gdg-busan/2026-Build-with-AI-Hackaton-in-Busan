---
name: gdg-hackaton-patterns
description: Use when writing code, commits, API routes, or tests in the GDG Busan hackathon voting platform — encodes this repo's conventional-commit + PR-squash workflow, FSD architecture with @/shared aliases, the API-route security boundary, and the firebase-admin-mocked Vitest strategy extracted from git history.
version: 1.0.0
source: local-git-analysis
analyzed_commits: 102
---

# GDG Busan Hackathon — Repository Patterns

Patterns extracted from 102 commits of the GDG Busan "Build with AI" voting platform.
Next.js 16 (App Router) + React 19 + TypeScript 5 + Firebase (Firestore/Auth/Admin SDK),
Tailwind v4 + shadcn/ui, pnpm.

## Commit Conventions

This repo uses **conventional commits, bilingual (Korean primary, English secondary)**.
Distribution across history: `feat` 38, `fix` 28, `chore` 10, `docs` 6, `test` 4, `refactor` 4, `perf` 2, `deploy` 2.

```
<type>(<scope>)?: <description in Korean or English>
```

- **Types in use:** `feat`, `fix`, `chore`, `docs`, `test`, `refactor`, `perf`, `deploy`. (`deploy` is repo-specific, for deployment-config changes — Netlify/Render/Firebase App Hosting.)
- **Scopes seen:** `seed`, `chat`, `firestore`, `env`, `build`. Add a scope when the change is confined to one of these areas.
- **Language:** Korean subjects are the norm for feature/fix work (`fix: 투표 보안 취약점 및 린트 이슈 수정`); English is also accepted (`feat: Add attendee code lookup by email`). Match the surrounding recent commits — do not mix languages within one subject.
- **No attribution footer** — disabled globally via `~/.claude/settings.json`. Do not add `Co-Authored-By` / "Generated with" lines.

### PR Squash-Merge Workflow

Work lands via **squash-merged PRs**; the squashed subject carries the PR number:

```
feat(chat): 클립보드 이미지 붙여넣기 채팅 업로드 지원 (#26)
refactor: 25팀 고정 제한 제거, 팀 수/인원 유연화 (#25)
fix: Firestore permission-denied 에러 해결 (#22)
```

Branch → PR → squash merge to `main`. The `(#N)` suffix is added by GitHub at merge time — don't hand-write it on local commits. Use the `draft-pr` skill to open the PR.

## Code Architecture

The repo is **mid-migration to Feature-Sliced Design**. Two trees coexist by design:

```
app/                         # Next.js App Router — routes only
├── page.tsx                 # / (code login)
├── vote/page.tsx            # /vote
├── admin/page.tsx           # /admin
├── results/page.tsx         # /results
├── lookup/page.tsx          # /lookup
└── api/                     # Route handlers (server boundary)
    ├── auth/route.ts        ├── vote/route.ts      ├── admin/route.ts
    ├── chat/{send,rooms,upload}/route.ts
    ├── cheer/route.ts       ├── feedback/route.ts  ├── lookup/route.ts
    └── team/route.ts        └── user/route.ts

src/                         # FSD layers
├── features/                # auth, voting, chat, cheer, feedback, mission,
│                            #   announcement, results — each a vertical slice
├── widgets/                 # admin, countdown, team-card, team-detail
└── shared/
    ├── api/                 # firebase-admin, firebase client
    ├── config/              # constants (EVENT_ID, ...)
    ├── lib/                 # scoring, utilities
    ├── types/               # UserRole, VotingPhase, ...
    ├── ui/                  # shared components
    └── __tests__/           # Vitest suites
```

**Import alias:** always `@/...` mapping into `src/` (e.g. `@/shared/api/firebase-admin`, `@/shared/config/constants`, `@/shared/types`). New shared code goes under the correct `src/shared/<slice>` — never reach across feature slices directly.

When adding a feature, create a slice under `src/features/<name>/` (with `ui/`, and lib/types as needed) rather than dropping files into `app/`.

## API Route Pattern (Server Boundary)

`app/api/*/route.ts` handlers are the security boundary. The established shape (from `app/api/vote/route.ts`):

```ts
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/shared/api/firebase-admin";
import { EVENT_ID } from "@/shared/config/constants";
import type { UserRole, VotingPhase } from "@/shared/types";

export async function POST(req: NextRequest) {
  try {
    // 1. Bearer token from Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "인증 토큰이 필요합니다" }, { status: 401 });
    }
    // 2. Verify Firebase ID token (try/catch → 401 on failure)
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(authHeader.slice(7));
    } catch {
      return NextResponse.json({ error: "유효하지 않은 인증 토큰입니다" }, { status: 401 });
    }
    // 3. Read claims (role/teamId), default role "participant"
    // 4. Validate body BEFORE dedup (Array.isArray, length checks → 400)
    // 5. Dedup user-supplied arrays: [...new Set(raw)]
    // 6. Atomic Firestore write: batch / runTransaction with FieldValue.increment
    // 7. Return NextResponse.json(...) with explicit status
  } catch (err) {
    // top-level catch → 500, log server-side
  }
}
```

Non-negotiables from the history:
- **Korean user-facing error messages**, explicit HTTP status codes (`401`/`400`/`404`/`500`).
- **Verify identity server-side via `adminAuth.verifyIdToken`** — never trust client-passed role/teamId without the token's claims.
- **Validate input before transforming it** (`fix: selectedTeams 배열 검증을 dedup 이전으로 이동`).
- **Atomic writes** with batch or `runTransaction` + `FieldValue.increment` for vote/count mutations (guards against TOCTOU — `fix: 투표 TOCTOU race condition`).
- **No direct client Firestore writes for state changes.** History repeatedly moved client writes into API routes (`fix(chat): 메시지를 API route로 전환`); keep cheer/feedback/chat going through routes, with `firebase/firestore.rules` enforcing least-privilege as the second layer.

After editing any route, run the **`verify-api-security`** and **`verify-firestore-paths`** skills.

## Scoring

Weighted normalized score lives in `src/shared/lib/scoring.ts`:
`finalScore = judgeNormalized × judgeWeight + participantNormalized × participantWeight`,
each group normalized as (votes ÷ group max) × 100. Keep tie-resolution and rank-override logic here, covered by `scoring.test.ts`.

## Testing Patterns

- **Framework:** Vitest for unit/integration (`src/shared/__tests__/`), Playwright for E2E (`e2e/`).
- **Suites:** `route-handlers`, `api-security`, `concurrency`, `data-integrity`, `scoring`, `env`.
- **firebase-admin is mocked at module level** — `vi.fn()` mocks declared and `vi.mock` applied **before importing the route handlers**, with a chainable Firestore mock (`makeDocRef` returning `get/set/update/delete/collection`). Reuse that helper shape when testing a new route.
- **AAA structure**, descriptive behavior-named tests.
- E2E specs cover `voting`, `mobile`, `accessibility` flows.

Run everything through the **`verify-tests`** skill (Vitest + build + lint + typecheck), or **`verify-implementation`** to run all verify-* skills in parallel before a PR/deploy.

## Workflows

### Add an API route
1. Create `app/api/<name>/route.ts` following the server-boundary pattern above.
2. Move any client-side writes for this feature out of `src/features/*` client actions into the route.
3. Add/extend Firestore rules in `firebase/firestore.rules` (least-privilege).
4. Add a Vitest suite in `src/shared/__tests__/` with module-level firebase-admin mocks.
5. Run `verify-api-security`, `verify-firestore-paths`, `verify-tests`.
6. Commit `feat(<scope>): <korean desc>`, open Draft PR via `draft-pr`.

### Add a feature slice
1. `src/features/<name>/` with `ui/` components; shared types in `src/shared/types`, constants in `src/shared/config`.
2. Wire into the relevant `app/*/page.tsx` route.
3. Import only via `@/...` aliases; no cross-feature imports.

### Touch Firestore data model
Model is `events/{eventId}` → subcollections `teams`, `users/{uniqueCode}`, `votes/{voterId}`. Guard PII on `users` (`fix: users 컬렉션 PII 노출 방지`). Validate Storage URLs on image fields (`fix(firestore): imageUrl에 Firebase Storage URL 패턴 검증 추가`).

## Red Flags (caught in this repo's history)

| Anti-pattern | What history did instead |
|---|---|
| Client Firestore write for state change | Routed through `app/api/*` + rules |
| Validating after transforming input | Validate before dedup/transform |
| Non-atomic read-then-write counters | `runTransaction` / batch + `FieldValue.increment` |
| Trusting client-passed role/teamId | Read from verified token claims |
| English-only error strings in UI paths | Korean user-facing messages |
| Hand-written `(#N)` in commits | Let GitHub add it at squash-merge |
