---
name: handoff
description: 세션 종료 시 HANDOFF.md를 생성하여 다음 세션/에이전트에 컨텍스트 전달.
---

## Purpose

세션 간 컨텍스트를 유지하기 위해 프로젝트 루트에 `HANDOFF.md` 파일을 생성합니다. 다음 세션이나 다른 에이전트가 현재 작업 상태를 빠르게 파악할 수 있도록 합니다.

## When to Run

- 세션 종료 전 작업 요약이 필요할 때
- 다른 에이전트에게 작업을 인계할 때
- 복잡한 작업 중간에 컨텍스트를 저장할 때

## Workflow

### Step 0: 기존 HANDOFF.md 확인

프로젝트 루트에 `HANDOFF.md`가 이미 존재하면 내용을 읽어 이전 컨텍스트를 파악한 뒤 덮어씁니다.

### Step 1: 변경사항 수집

현재 브랜치 상태를 확인합니다.

```bash
CURRENT_BRANCH=$(git branch --show-current)
```

main 브랜치에서 직접 작업 중이라면:
```bash
git log --oneline -10
git diff --stat
```

feature 브랜치에서 작업 중이라면:
```bash
git diff main --stat
git log main..HEAD --oneline
```

### Step 2: HANDOFF.md 생성

프로젝트 루트에 `HANDOFF.md`를 아래 템플릿으로 생성합니다:

```markdown
# Handoff — [YYYY-MM-DD]

## Branch
`[현재 브랜치명]`

## Completed
- [완료된 작업 항목들을 구체적으로 나열]

## In Progress / Remaining
- [미완료 작업 또는 남은 TODO]

## Attempted but Failed
- [시도했으나 실패한 접근 방식과 이유]
- (없으면 "None" 기재)

## Key Decisions
- [중요한 설계/구현 결정 사항과 그 이유]

## Next Steps
1. [다음에 해야 할 작업을 우선순위 순으로]
2. ...

## Relevant Files
| File | Change |
|------|--------|
| `path/to/file` | 변경 내용 요약 |
```

### Step 3: 결과 확인

생성된 `HANDOFF.md`의 내용을 출력하여 사용자에게 확인합니다.

## Notes

- `HANDOFF.md`는 `.gitignore`에 추가하지 않습니다 (팀원 간 공유 가능).
- 기존 `HANDOFF.md`가 있으면 덮어씁니다 (최신 상태만 유지).
- 민감한 정보(토큰, 비밀번호 등)는 절대 포함하지 않습니다.
