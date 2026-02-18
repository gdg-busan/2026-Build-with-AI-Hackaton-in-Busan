---
name: verify-implementation
description: 등록된 모든 검증 스킬을 순차 실행하는 통합 검증. 배포 전 또는 PR 전 사용.
---

## Purpose

등록된 모든 verify 스킬을 순차적으로 실행하고 종합 결과를 보고합니다.

## When to Run

- 배포 전 전체 검증
- PR 생성 전 최종 확인
- 대규모 리팩토링 후

## 실행 대상 스킬

| # | 스킬 | 설명 |
|---|------|------|
| 1 | verify-api-security | API 라우트 보안 패턴 검증 |
| 2 | verify-firestore-paths | Firestore 경로 일관성 검증 |

## Workflow

각 스킬의 SKILL.md를 읽고 Workflow 섹션의 모든 검사를 순차 실행합니다. 각 스킬의 결과를 Output Format에 맞게 수집하고, 최종 종합 보고서를 생성합니다.

## Output Format

```markdown
## 통합 검증 결과

### verify-api-security: X/Y PASS
| 검사 | 결과 |
|------|------|
| ... | ... |

### verify-firestore-paths: X/Y PASS
| 검사 | 결과 |
|------|------|
| ... | ... |

### 종합: PASS / FAIL (N개 이슈)
```
