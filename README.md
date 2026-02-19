# GDG Busan "Build with AI" Hackathon Voting Platform

25팀(2인 1팀, 50명) 중 심사위원+참가자 가중 투표로 TOP 10을 선정하는 실시간 투표 시스템.

## Tech Stack

- **Framework**: Next.js 16 (App Router) + React 19 + TypeScript 5
- **Database**: Firebase Firestore (실시간 구독)
- **Auth**: Firebase Custom Token (코드 기반 인증)
- **UI**: Tailwind CSS v4 + shadcn/ui + Framer Motion
- **Theme**: "Living Terminal" (다크 터미널 테마, 글로우/스캔라인 효과)
- **Package Manager**: pnpm

## Getting Started

### 1. 환경 변수 설정

```bash
cp .env.local.example .env.local
```

`.env.local`에 Firebase 설정값을 입력합니다:

| 변수 | 설명 |
|------|------|
| `NEXT_PUBLIC_FIREBASE_*` (6개) | Firebase Client SDK 설정 |
| `FIREBASE_PROJECT_ID` | Firebase 프로젝트 ID |
| `FIREBASE_CLIENT_EMAIL` | 서비스 계정 이메일 |
| `FIREBASE_PRIVATE_KEY` | 서비스 계정 비공개 키 (**큰따옴표로 감싸야 함**) |
| `NEXT_PUBLIC_EVENT_ID` | 이벤트 ID (기본: `gdg-busan-2026`) |

### 2. 의존성 설치 및 실행

```bash
pnpm install
pnpm dev
```

### 3. 초기 데이터 시드

```bash
npx tsx scripts/seed-admin.ts
```

## Pages

| Route | 용도 | 인증 |
|-------|------|------|
| `/` | 코드 입력 로그인 | 불필요 |
| `/vote` | 팀 목록 + 투표 + 팀 상세 보기 | 필요 (participant/judge) |
| `/admin` | 이벤트/팀/유저 관리 | 필요 (admin) |
| `/results` | 결과 공개 (드라마틱 연출) | 필요 |

## Features

### 투표 시스템
- 참가자/심사위원이 최대 N팀(설정 가능)에 투표
- 자기 팀 투표 방지 (4중 검증: 클라이언트 UI → Firestore Rules → API → Admin)
- Firestore batch write로 원자적 투표 처리

### 팀 상세 보기 (Inspect Sheet)
- 카드의 "상세 보기" 클릭 → 우측 Drawer Sheet 열림
- `$ inspect --team="팀명"` 터미널 테마
- 전체 설명, 멤버 프로필(이름+소개), 프로젝트 URL, Sheet 내 투표 버튼

### 프로필 수정
- 참가자/심사위원이 자신의 이름(20자)과 소개(100자) 수정 가능
- 팀 상세 보기에서 멤버별 이름+소개 표시

### 팀 정보 수정
- 참가자가 소속 팀의 별칭, 설명, 프로젝트 URL 수정 가능

### 실시간 업데이트
- 모든 페이지에서 Firestore `onSnapshot` 실시간 구독
- 투표 진행률, 팀 정보 변경 즉시 반영

### 결과 공개
- 드라마틱 카운트다운 + 순차 공개 연출
- 정규화 가중 점수: `finalScore = (judgeNorm × judgeWeight) + (participantNorm × participantWeight)`

## API Routes

| Method | Route | 설명 |
|--------|-------|------|
| POST | `/api/auth` | 코드 기반 로그인 (Custom Token 발급) |
| POST | `/api/vote` | 투표 제출 |
| PUT | `/api/team` | 팀 정보 수정 (참가자) |
| PUT | `/api/user` | 프로필 수정 - 이름, 소개 (참가자/심사위원) |
| POST | `/api/admin` | 관리자 액션 (이벤트/팀/유저 관리) |

## Firestore Data Model

```
events/{eventId}
  ├── teams/{teamId}       # name, nickname, description, emoji, projectUrl,
  │                        # memberUserIds[], judgeVoteCount, participantVoteCount
  ├── users/{uniqueCode}   # name, role, teamId, hasVoted, bio
  └── votes/{voterId}      # voterId, selectedTeams[], role, timestamp
```

## Authentication Flow

1. 사용자가 고유 코드 입력 (예: `P001`, `J001`)
2. `/api/auth`에서 Firestore `users` 컬렉션 조회
3. Firebase Admin SDK로 Custom Token 발급 (claims: role, teamId, name)
4. 클라이언트에서 `signInWithCustomToken()`으로 인증

## Design Theme: "Living Terminal"

| 요소 | 값 |
|------|-----|
| 배경 | `#0A0E1A` |
| 터미널 그린 | `#00FF88` |
| AI 블루 | `#4DAFFF` |
| 오렌지 | `#FF6B35` |
| 폰트 | JetBrains Mono + DM Sans |
| 효과 | 글로우, 스캔라인, dot-grid, 타이핑 커서 |

## Scripts

```bash
pnpm dev          # 개발 서버 (http://localhost:3000)
pnpm build        # 프로덕션 빌드
pnpm lint         # ESLint
pnpm start        # 프로덕션 서버
```

## License

MIT
