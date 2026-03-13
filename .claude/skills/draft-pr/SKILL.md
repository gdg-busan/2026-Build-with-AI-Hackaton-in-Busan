---
name: draft-pr
description: 현재 브랜치 변경사항을 분석하여 Draft PR을 자동 생성.
---

## Purpose\_

현재 브랜치의 변경사항을 분석하고 `gh pr create --draft`로 Draft PR을 자동 생성합니다. PR 제목, 본문, 라벨을 자동으로 구성합니다.

## When to Run

- feature 브랜치에서 작업 후 Draft PR을 올릴 때
- 코드 리뷰 요청 전 초안 PR이 필요할 때

## Workflow

### Step 1: Pre-flight 체크

```bash
CURRENT_BRANCH=$(git branch --show-current)
```

- `main` 또는 `master` 브랜치라면 중단하고 브랜치 생성을 안내합니다.
- uncommitted 변경이 있으면 경고 메시지를 출력합니다.
- remote에 push되지 않은 커밋이 있으면 `git push -u origin $CURRENT_BRANCH`를 실행합니다.

### Step 2: 변경사항 분석

```bash
git log main..HEAD --oneline
git diff main...HEAD --stat
```

커밋 메시지와 변경된 파일 목록을 분석하여 PR 내용을 구성합니다.

### Step 3: 라벨 자동 감지

변경된 파일 경로를 기반으로 라벨을 감지합니다:

| 파일 경로 패턴                       | 라벨  |
| ------------------------------------ | ----- |
| `app/api/`                           | api   |
| `__tests__/`, `*.test.ts`            | test  |
| `components/`, `app/(*)/**/page.tsx` | ui    |
| `lib/`, `shared/`                    | core  |
| `CLAUDE.md`, `.claude/`, `scripts/`  | infra |
| `*.css`, `tailwind*`                 | style |

### Step 4: PR 생성

PR 본문 템플릿:

```markdown
## Summary

- [변경사항 요약 bullet points]

## Changes

[변경된 파일 목록과 각 변경 내용]

## Test plan

- [ ] `pnpm build` 성공
- [ ] `pnpm lint` 통과
- [추가 검증 항목]

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

감지된 라벨이 있으면 `--label` 옵션을 추가합니다. 라벨이 GitHub repo에 존재하지 않으면 `--label`을 생략합니다.

```bash
gh pr create --draft \
  --title "[간결한 PR 제목 (70자 이하)]" \
  --body "[위 템플릿 기반 본문]" \
  --label "[감지된 라벨들, 쉼표 구분 — 없으면 생략]"
```

### Step 5: 결과 출력

생성된 PR URL을 출력합니다.

## Notes

- `gh` CLI가 설치되어 있어야 합니다 (`brew install gh`).
- GitHub 인증이 완료되어 있어야 합니다 (`gh auth status`).
- Draft PR이므로 merge가 바로 되지 않습니다 — Ready for review로 전환 필요.
