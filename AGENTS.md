# Repository Guidelines

## Project Structure & Module Organization
- `app/`: Next.js App Router pages, layouts, providers, and API routes (`app/api/*/route.ts`).
- `components/`: UI and feature components; shared primitives live in `components/ui/`, chat UI in `components/chat/`.
- `lib/`: business logic, Firebase clients/admin setup, constants, and typed helpers.
- `hooks/`: reusable React hooks for chat, voting timer, and mission state.
- `lib/__tests__/`: Vitest unit tests (currently focused on scoring logic).
- `scripts/`: one-off operational scripts (for example `scripts/seed-admin.ts`).
- `public/`: static assets; `firebase/firestore.rules`: Firestore authorization rules.

## Build, Test, and Development Commands
- `pnpm install`: install dependencies.
- `pnpm dev`: run local dev server at `http://localhost:3000`.
- `pnpm build`: produce production build.
- `pnpm start`: run production server from build output.
- `pnpm lint`: run ESLint (Next.js + TypeScript rules).
- `npx vitest run`: run unit tests.
- `npx tsx scripts/seed-admin.ts`: seed admin/event data after setting `.env.local`.

## Coding Style & Naming Conventions
- Language: TypeScript (`strict` mode) with React 19 + Next.js 16.
- Indentation: 2 spaces; keep imports grouped and prefer `@/*` alias over long relative paths.
- Components: `PascalCase.tsx` (for example `TeamDetailSheet.tsx`).
- Hooks/utils: `camelCase.ts` (for example `useVotingTimer.ts`, `mission-tracker.ts`).
- Follow ESLint config in `eslint.config.mjs`; run `pnpm lint` before opening a PR.

## Testing Guidelines
- Framework: Vitest.
- Place tests in `lib/__tests__/` and name files `*.test.ts`.
- Keep tests deterministic and focused on scoring, mission, and vote-state logic.
- Add/adjust tests for behavior changes, especially ranking, tie-break, and weighted-score logic.

## Commit & Pull Request Guidelines
- Use Conventional Commits seen in history: `feat:`, `fix:`, `chore:` (optionally with issue refs like `(#7)`).
- Keep each commit scoped to one concern.
- PRs should include:
  - clear summary of user-visible/logic changes,
  - linked issue or task ID,
  - screenshots or short recordings for UI changes (`/vote`, `/admin`, `/results`),
  - notes for config/rules updates (Firestore rules, env vars).

## Security & Configuration Tips
- Never commit secrets; use `.env.local` (copy from `.env.local.example`).
- Validate voting constraints across UI, API, and Firestore rules when modifying vote flows.
