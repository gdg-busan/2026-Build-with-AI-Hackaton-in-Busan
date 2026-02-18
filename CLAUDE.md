# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GDG Busan "Build with AI" 해커톤 투표 플랫폼. 25팀(2인 1팀, 50명) 중 심사위원+참가자 가중 투표로 TOP 10을 선정하는 실시간 투표 시스템.

## Commands

```bash
pnpm dev          # Dev server (http://localhost:3000)
pnpm build        # Production build
pnpm lint         # ESLint
npx tsx scripts/seed-admin.ts  # Seed initial admin user + event
```

## Tech Stack

- **Next.js 16** (App Router) + React 19 + TypeScript 5
- **Firebase**: Firestore (realtime DB), Auth (custom token), Admin SDK (API routes)
- **UI**: Tailwind CSS v4 + shadcn/ui (New York style) + Framer Motion + canvas-confetti
- **Package Manager**: pnpm

## Architecture

### Authentication Flow
코드 기반 인증: 고유 코드 입력 → `/api/auth`에서 Firestore 조회 → Firebase Admin SDK로 Custom Token 발급 (claims: role, teamId, name) → `signInWithCustomToken()`으로 클라이언트 인증.

### Firebase Client SDK (`lib/firebase.ts`)
Proxy 대신 **getter 함수** 패턴 사용. Firebase SDK의 `doc()`, `collection()` 등은 `instanceof` 체크를 하므로 Proxy가 동작하지 않음. 반드시 `getFirebaseDb()`, `getFirebaseAuth()` 함수를 호출하여 실제 인스턴스를 전달해야 함.

### Firestore Data Model
```
events/{eventId}           # status, judgeWeight, participantWeight, maxVotesPerUser
  ├── teams/{teamId}       # name, description, emoji, memberUserIds, judgeVoteCount, participantVoteCount
  ├── users/{uniqueCode}   # name, role, teamId, hasVoted
  └── votes/{voterId}      # voterId, selectedTeams[], role, timestamp
```

### Scoring
정규화 가중 점수: `finalScore = (judgeNormalized × judgeWeight) + (participantNormalized × participantWeight)`. 각 정규화는 해당 그룹 최다 득표 대비 비율 × 100.

### Key Patterns
- **Real-time**: Firestore `onSnapshot`으로 모든 페이지 실시간 업데이트
- **Atomic Votes**: API route에서 Firestore batch write (vote 문서 + team count increment + user hasVoted)
- **4중 부정 방지**: 클라이언트 UI → Firestore Rules → API 검증 → Admin 모니터링
- **상태 흐름**: waiting → voting → closed → revealed (admin에서 자유 전환 가능)

## Pages

| Route | 용도 | 인증 |
|-------|------|------|
| `/` | 코드 입력 로그인 | 불필요 |
| `/vote` | 팀 목록 + 투표 | 필요 (participant/judge) |
| `/admin` | 이벤트/팀/유저 관리 | 필요 (admin) |
| `/results` | 결과 공개 (드라마틱 연출) | 필요 |
| `/display` | 프로젝터용 뷰 | 불필요 |

## Environment Variables

`.env.local.example` 참조. Firebase Client SDK (`NEXT_PUBLIC_*` 6개) + Admin SDK (3개: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`) + `NEXT_PUBLIC_EVENT_ID`.

`FIREBASE_PRIVATE_KEY`는 반드시 **큰따옴표로 감싸야** 함. `FIREBASE_CLIENT_EMAIL`은 서비스 계정 JSON의 `client_email` 값 사용.

## Skills

| 스킬 | 설명 |
|------|------|
| verify-api-security | API 라우트 보안 패턴 검증 |
| verify-firestore-paths | Firestore 경로 일관성 검증 |
| verify-implementation | 등록된 모든 검증 스킬 통합 실행 |

## Design Theme: "Living Terminal"

배경 `#0A0E1A`, 강조 `#00FF88` (터미널 그린), `#4DAFFF` (AI 블루), `#FF6B35` (오렌지). JetBrains Mono + DM Sans 폰트. 글로우/스캔라인/dot-grid 효과.
