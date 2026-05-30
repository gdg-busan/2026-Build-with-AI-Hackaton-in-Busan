---
id: gdg-hackaton-commit-convention
trigger: when writing a commit message in this repo
confidence: 0.9
domain: git
source: local-repo-analysis
---

# Use bilingual conventional commits

## Action
Prefix commits with `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`, `perf:`, or `deploy:` (deploy is repo-specific for deployment config). Add a scope `(seed|chat|firestore|env|build)` when the change is confined there. Write the subject in Korean for feature/fix work (English also accepted) and match the language of recent commits. Do NOT add a `Co-Authored-By` / "Generated with" footer — attribution is disabled globally.

## Evidence
- 102 commits analyzed; ~98% follow conventional format
- feat 38, fix 28, chore 10, docs 6, test 4, refactor 4, perf 2, deploy 2
- Korean subjects dominate fix/feat work (e.g. `fix: 투표 보안 취약점 및 린트 이슈 수정`)

---
id: gdg-hackaton-pr-squash-workflow
trigger: when finishing a change or preparing to merge to main
confidence: 0.8
domain: git
source: local-repo-analysis
---

# Land work via squash-merged PRs

## Action
Work goes branch → PR → squash-merge to `main`. The `(#N)` suffix is appended by GitHub at merge time — never hand-write it on local commits. Use the `draft-pr` skill to open the PR.

## Evidence
- Squashed subjects carry PR numbers: `feat(chat): ... (#26)`, `fix: ... (#22)`
- 27+ merged PRs across history

---
id: gdg-hackaton-api-route-security-boundary
trigger: when adding or editing a Next.js API route handler (app/api/*/route.ts)
confidence: 0.9
domain: security
source: local-repo-analysis
---

# Enforce auth at the API-route boundary

## Action
In each `app/api/*/route.ts`: (1) read `Authorization: Bearer` header → 401 if missing; (2) `await adminAuth.verifyIdToken(token)` in try/catch → 401 on failure; (3) read role/teamId from the decoded token CLAIMS, never from the request body; (4) return explicit HTTP status codes with Korean user-facing error messages; (5) wrap the handler in a top-level try/catch → 500. Import admin via `@/shared/api/firebase-admin` and `EVENT_ID` from `@/shared/config/constants`.

## Evidence
- Established shape in app/api/vote/route.ts and all sibling routes
- `fix: 투표 보안 취약점` and Firestore-rules least-privilege restores

---
id: gdg-hackaton-validate-before-transform
trigger: when handling user-supplied arrays or input in an API route
confidence: 0.85
domain: security
source: local-repo-analysis
---

# Validate input before transforming it

## Action
Run `Array.isArray` / length / type checks and return 400 BEFORE deduping or mutating the input. Dedup user arrays with `[...new Set(raw)]` only after validation passes.

## Evidence
- Explicit fix: `fix: selectedTeams 배열 검증을 dedup 이전으로 이동`

---
id: gdg-hackaton-atomic-firestore-writes
trigger: when writing vote counts or any counter to Firestore
confidence: 0.85
domain: backend
source: local-repo-analysis
---

# Make counter writes atomic

## Action
Use `runTransaction` or a batch with `FieldValue.increment` for any read-then-write on vote/count fields. Never read a count, compute, then write it back separately.

## Evidence
- `fix: 투표 TOCTOU race condition 및 보안/린트 이슈 수정`
- vote/admin routes use transactions + FieldValue.increment

---
id: gdg-hackaton-no-direct-client-writes
trigger: when implementing a state-changing action in a feature slice (cheer, feedback, chat)
confidence: 0.85
domain: security
source: local-repo-analysis
---

# Route state changes through API routes, not direct client Firestore writes

## Action
For any write that changes shared state (cheer, feedback, chat, votes), call an `app/api/*` route rather than writing to Firestore from the client. Keep `firebase/firestore.rules` least-privilege as the second enforcement layer.

## Evidence
- `fix(chat): 메시지를 API route로 전환하여 messageCount 정상화 및 권한 수정`
- `fix: users 컬렉션 PII 노출 방지 - least-privilege 복원`

---
id: gdg-hackaton-fsd-import-alias
trigger: when adding or importing source files under src/
confidence: 0.8
domain: architecture
source: local-repo-analysis
---

# Follow Feature-Sliced Design with @/ aliases

## Action
Put route files in `app/`, sliced logic in `src/features/<name>/` (with `ui/`), shared code in `src/shared/{api,config,lib,types,ui}`, and composite UI in `src/widgets/`. Import only via `@/...` aliases. Do not import across feature slices directly.

## Evidence
- `refactor: Restructure to FSD architecture`
- 66 files under src/ split features(30)/shared(26)/widgets(10)

---
id: gdg-hackaton-firebase-admin-mock-tests
trigger: when writing a Vitest test for an API route handler
confidence: 0.8
domain: testing
source: local-repo-analysis
---

# Mock firebase-admin at module level before importing handlers

## Action
Declare `vi.fn()` mocks and apply `vi.mock` for firebase-admin BEFORE importing the route handler. Use a chainable `makeDocRef()` helper returning `get/set/update/delete/collection`. Place suites in `src/shared/__tests__/`, use AAA structure and behavior-named tests.

## Evidence
- src/shared/__tests__/route-handlers.test.ts established this pattern
- Suites: route-handlers, api-security, concurrency, data-integrity, scoring, env

---
id: gdg-hackaton-korean-error-messages
trigger: when returning an error response from an API route or UI-facing path
confidence: 0.8
domain: backend
source: local-repo-analysis
---

# Use Korean user-facing error messages

## Action
Return Korean strings in `NextResponse.json({ error: "..." })` for user-facing failures (e.g. "인증 토큰이 필요합니다", "선택한 팀이 없습니다"), paired with explicit HTTP status codes. Keep detailed/English context in server-side logs only.

## Evidence
- Consistent across app/api/vote/route.ts and sibling handlers

---
id: gdg-hackaton-run-verify-skills
trigger: after editing API routes, Firestore access, or before opening a PR / deploying
confidence: 0.85
domain: testing
source: local-repo-analysis
---

# Run the repo's verify-* skills before shipping

## Action
After touching an API route run `verify-api-security` and `verify-firestore-paths`. Before a PR or deploy run `verify-tests` (Vitest + build + lint + typecheck) or `verify-implementation` to run all verify-* skills in parallel.

## Evidence
- Dedicated skills committed: verify-api-security, verify-firestore-paths, verify-tests, verify-implementation
- `feat: verify-tests 스킬 추가 및 검증 스킬 개선`
