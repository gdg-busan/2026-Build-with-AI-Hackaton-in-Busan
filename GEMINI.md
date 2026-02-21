# GDG Busan "Build with AI" Hackathon Voting Platform

This project is a real-time voting and results-reveal platform for the GDG Busan Hackathon. It features a unique "Living Terminal" aesthetic and manages weighted voting between participants and judges.

## Project Overview

- **Purpose**: Facilitate fair and dramatic voting for 25 hackathon teams to select the TOP 10.
- **Architecture**: Next.js 16 (App Router) with a serverless backend via API Routes and Firebase Firestore for real-time synchronization.
- **Authentication**: Custom token-based system where users log in using unique codes (e.g., `P001` for participants, `J001` for judges).
- **Design System**: A dark terminal-themed UI ("Living Terminal") built with Tailwind CSS v4, shadcn/ui, and Framer Motion for high-fidelity animations.

## Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript 5, Framer Motion, Lucide React, Sonner (Toasts), Canvas Confetti.
- **Backend/Database**: Firebase (Firestore, Authentication, Cloud Functions), Firebase Admin SDK.
- **Styling**: Tailwind CSS v4 (using the `@tailwindcss/postcss` plugin), `class-variance-authority` for component variants.
- **Testing**: Playwright for E2E testing, Vitest for unit testing.

## Key Directory Structure

- `app/`: Next.js App Router pages and API routes.
  - `api/`: Server-side logic for authentication, voting, and admin actions.
  - `vote/`: Main voting interface.
  - `results/`: Dramatic results reveal page.
  - `admin/`: Management dashboard for event control.
- `components/`: Modular UI components.
  - `chat/`: Real-time chat panels and message components.
  - `ui/`: shadcn/ui base components.
- `lib/`: Core business logic and shared utilities.
  - `scoring.ts`: Weighted scoring algorithms (Judge: 80%, Participant: 20%).
  - `types.ts`: Centralized TypeScript interfaces.
  - `firebase.ts` / `firebase-admin.ts`: Firebase configuration for client and server.
- `hooks/`: Custom React hooks for timers (`useVotingTimer`), chat, and missions.
- `firebase/`: Firestore security rules (`firestore.rules`).
- `scripts/`: Utility scripts, including `seed-admin.ts` for database initialization.

## Building and Running

- **Development**: `pnpm dev`
- **Build**: `pnpm build`
- **Start**: `pnpm start`
- **Lint**: `pnpm lint`
- **Seed Data**: `npx tsx scripts/seed-admin.ts` (Requires `.env.local` with Admin SDK credentials)
- **E2E Tests**: `npx playwright test`

## Development Conventions

- **Data Fetching**: Use Firestore `onSnapshot` via hooks for real-time UI updates.
- **Voting Integrity**: Voting is handled exclusively through `/api/vote` using Firestore Transactions to ensure atomic updates and prevent double-voting.
- **Styling**: Adhere to the "Living Terminal" theme using predefined CSS variables and Framer Motion for transitions.
- **Security**: Client-side Firestore access is restricted by `firestore.rules`. Sensitive operations (voting, admin tasks) are gated by custom claims in JWTs.
- **Code Style**: ESLint is configured to enforce Next.js and TypeScript best practices.

## Domain Model (Key Entities)

- **Event**: Manages the global state (waiting, voting, closed, revealed).
- **Team**: Stores team metadata, vote counts, and member IDs.
- **User**: Stores profile info, roles (participant/judge/admin), and voting status.
- **Vote**: Records individual voting transactions (Phase 1: Participants, Phase 2: Judges).
