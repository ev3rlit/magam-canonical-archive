# Bidirectional Editing Manual QA Checklist (BIDI-024)

## Scope
- 자유 배치(move)
- anchor/position/gap 편집(update)
- markdown content 편집(update)
- id 변경 + 참조 동기화(update)
- node.create
- node.reparent + cycle 차단
- conflict 롤백 UX
- self-origin loop 방지

## Preconditions
- WebSocket server 실행 (`bun run app/ws/server.ts`)
- 앱 실행 (`bun run app`)
- 테스트 대상 파일 열림 (예: `examples/mindmap.tsx`)

## Checklist

- [ ] **Move**: 노드 드래그 후 파일의 `x/y`가 업데이트된다.
- [ ] **Move Conflict**: stale `baseVersion` 시 `VERSION_CONFLICT(40901)`가 발생하고 UI가 롤백된다.
- [ ] **Update Anchor**: `anchor/position/gap` 수정이 코드 props에 반영된다.
- [ ] **Update Markdown**: markdown 편집 시 `<Markdown>{`...`}</Markdown>` 내용이 반영된다.
- [ ] **Update ID**: 노드 id 변경 시 관련 `from/to/anchor` 참조가 함께 변경된다.
- [ ] **Create Node**: `node.create` 호출 시 새 노드가 `Canvas/MindMap`에 삽입된다.
- [ ] **Reparent**: `node.reparent` 호출 시 `from`이 새 부모로 변경된다.
- [ ] **Cycle Guard**: cycle 조건에서 `MINDMAP_CYCLE(40902)`가 발생한다.
- [ ] **Self-origin Ignore**: 같은 `originId + commandId`의 `file.changed`는 재렌더를 유발하지 않는다.
- [ ] **External Change Reload**: 다른 origin의 `file.changed`는 재렌더를 유발한다.

---

# Manual QA Results Template

- Date:
- Tester:
- Branch/Commit:
- Environment:

## Results

| Item | Result (Pass/Fail) | Notes | Evidence |
|---|---|---|---|
| Move |  |  |  |
| Move Conflict Rollback |  |  |  |
| Update Anchor |  |  |  |
| Update Markdown |  |  |  |
| Update ID Ref Sync |  |  |  |
| Create Node |  |  |  |
| Reparent |  |  |  |
| Cycle Guard (40902) |  |  |  |
| Self-origin Ignore |  |  |  |
| External Reload |  |  |  |

## Summary
- Overall:
- Open issues:
- Follow-up actions:
