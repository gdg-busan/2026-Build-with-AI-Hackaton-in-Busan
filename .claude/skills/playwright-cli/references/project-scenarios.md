# GDG Busan 해커톤 투표 플랫폼 — Playwright 시나리오 가이드

이 프로젝트에서 playwright-cli를 사용할 때 참고할 프로젝트 맞춤 시나리오와 설정입니다.

## 기본 설정

- **Base URL**: `http://localhost:3000`
- **dev server 시작**: `pnpm dev`
- **테스트 코드**: 환경변수 `E2E_PARTICIPANT_CODE` / `E2E_ADMIN_CODE` 또는 기본값 사용
- **Playwright 설정**: `playwright.config.ts` (desktop Chrome, iPhone 14, iPad)

## 인증 플로우

이 프로젝트는 코드 입력 방식으로 인증합니다. 모든 페이지 테스트 전에 로그인이 필요합니다.

### 참가자 로그인

```bash
playwright-cli open http://localhost:3000
playwright-cli snapshot
# 코드 입력 필드를 찾아 fill
playwright-cli fill <textbox-ref> "GDG-P02D4BZ"
# 접속하기 버튼 클릭
playwright-cli click <button-ref>
# /vote 페이지로 리다이렉트 대기
playwright-cli snapshot
```

### 관리자 로그인

```bash
playwright-cli open http://localhost:3000
playwright-cli fill <textbox-ref> "GDG-A02XHNZ"
playwright-cli click <button-ref>
# /admin 페이지로 리다이렉트
playwright-cli snapshot
```

### 잘못된 코드 입력

```bash
playwright-cli fill <textbox-ref> "INVALID-CODE"
playwright-cli click <button-ref>
# 에러 메시지 확인
playwright-cli snapshot
```

## 핵심 시나리오

### 1. 투표 플로우 (참가자)

참가자가 로그인 → 팀 목록 확인 → 팀 선택 → 투표 제출

```bash
# 로그인 후 /vote 페이지
playwright-cli snapshot
# 팀 카드 3개 선택 (cursor-pointer 클래스의 카드)
playwright-cli click <team-card-1>
playwright-cli click <team-card-2>
playwright-cli click <team-card-3>
# submit_vote 버튼 클릭
playwright-cli click <submit-btn>
# 확인 다이얼로그에서 '투표하기' 클릭
playwright-cli click <confirm-btn>
# 투표 완료 메시지 확인
playwright-cli snapshot
```

### 2. 관리자 이벤트 상태 전환

관리자가 이벤트 상태를 순차적으로 변경하는 플로우

상태 순서: `waiting` → `voting_p1` → `closed_p1` → `revealed_p1` → `voting_p2` → `closed_p2` → `revealed_final`

```bash
# 관리자 로그인 후 /admin
playwright-cli snapshot
# '이벤트 제어' 섹션 열기
playwright-cli click <event-control-btn>
# 상태 변경 버튼 클릭 (예: '1차 투표중')
playwright-cli click <status-btn>
# confirm 다이얼로그 수락
playwright-cli dialog-accept
playwright-cli snapshot
# 배너에서 상태 변경 확인
```

### 3. 투표 초기화

```bash
# 관리자 로그인 후
playwright-cli click <event-control-btn>
playwright-cli click <reset-votes-btn>
playwright-cli dialog-accept
playwright-cli snapshot
```

### 4. 결과 페이지 확인

```bash
# 상태가 revealed_p1 또는 revealed_final일 때
playwright-cli goto http://localhost:3000/results
playwright-cli snapshot
# 드라마틱 연출 애니메이션 대기
playwright-cli screenshot --filename=results.png
```

### 5. 모바일 반응형 테스트

```bash
# iPhone 14 뷰포트로 리사이즈
playwright-cli resize 390 844
playwright-cli goto http://localhost:3000
playwright-cli snapshot
# 모바일에서의 투표 UI 확인
```

## 주의사항

- **코드 기반 인증**: 쿠키/세션 방식이 아니므로, `state-save`로 로그인 상태를 저장해두면 반복 로그인을 줄일 수 있음
- **실시간 업데이트**: Firestore `onSnapshot`을 사용하므로, 상태 변경 후 페이지가 자동 갱신됨. 별도 새로고침 불필요
- **다이얼로그 처리**: 상태 변경, 투표 제출, 초기화 등에서 confirm 다이얼로그가 뜸. `dialog-accept` 사용
- **E2E 테스트와의 관계**: `e2e/` 디렉토리에 Playwright Test 기반 E2E 테스트가 이미 있음. playwright-cli는 수동 탐색/디버깅용으로, `npx playwright test`는 자동화된 E2E 스위트 실행용
- **Dev 서버 필요**: playwright-cli 사용 전 `pnpm dev`로 개발 서버가 실행 중이어야 함
