# Quickstart: TSX-Backed Canvas Editing Commands

## 목적

`006-canvas-editing-commands` 기능을 구현/검증하기 위한 최소 실행 절차.

## 작업 문서 링크

- 스펙: `specs/006-canvas-editing-commands/spec.md`
- 플랜: `specs/006-canvas-editing-commands/plan.md`
- 태스크: `specs/006-canvas-editing-commands/tasks.md`
- 계약:
  - `specs/006-canvas-editing-commands/contracts/semantic-command-envelope-contract.md`
  - `specs/006-canvas-editing-commands/contracts/ui-intent-routing-contract.md`
  - `specs/006-canvas-editing-commands/contracts/editable-subset-contract.md`
  - `specs/006-canvas-editing-commands/contracts/tsx-patch-surface-contract.md`
  - `specs/006-canvas-editing-commands/contracts/patcher-minimal-diff-contract.md`
  - `specs/006-canvas-editing-commands/contracts/create-placement-contract.md`
  - `specs/006-canvas-editing-commands/contracts/rpc-command-mapping-contract.md`
  - `specs/006-canvas-editing-commands/contracts/reliability-history-contract.md`

## 1) 준비

```bash
cd /Users/danghamo/Documents/gituhb/magam-feature-web-editing-board-document
git checkout 006-canvas-editing-commands
bun install
```

## 2) 구현 순서

1. 편집 메타/command 타입 추가
   - `app/features/editing/commands.ts`
   - `app/features/editing/editability.ts`
   - `app/features/editing/createDefaults.ts`
2. parsed node에 `editMeta` 계산 추가
   - `app/features/render/parseRenderGraph.ts`
   - node data typing 정리
3. patch surface 분리
   - `app/ws/filePatcher.ts`
   - `app/ws/methods.ts`
4. 기존 편집 UI를 command builder로 연결
   - `app/components/GraphCanvas.tsx`
   - `app/components/editor/WorkspaceClient.tsx`
   - `app/components/nodes/TextNode.tsx`
   - `app/components/nodes/MarkdownNode.tsx`
   - `app/components/ui/StickerInspector.tsx`
5. 생성/구조 편집 UI 추가
   - `app/components/FloatingToolbar.tsx`
   - `app/config/contextMenuItems.ts`
   - `app/components/ContextMenu.tsx`
   - `app/components/GraphCanvas.drag.ts`
6. reliability/history 확장
   - `app/store/graph.ts`
   - `app/hooks/useFileSync.ts`

## 3) 구현 체크포인트

- Checkpoint A: 선택된 노드가 `editMeta`에 따라 absolute/relative/content/style/rename 가능 여부를 구분한다.
- Checkpoint B: absolute move는 `x`,`y`만 diff에 남는다.
- Checkpoint C: content update는 carrier별 surface만 diff에 남는다.
- Checkpoint D: style update는 whitelist field만 저장된다.
- Checkpoint E: Canvas create, MindMap child create, MindMap sibling create가 각각 올바른 scope에 삽입된다.
- Checkpoint F: reparent는 `from`만 바꾸고 cycle은 거부된다.
- Checkpoint G: rollback/undo/redo가 command 완료 이벤트 단위로 유지된다.
- Checkpoint H: editable subset 밖의 노드는 read-only로 표시되고 저장을 시도하지 않는다.
- Checkpoint I: create/reparent/rename 이후 self-origin `file.changed`를 기다리지 않아도 즉시 re-render 또는 selection handoff가 동작한다.

## 4) 테스트

```bash
# Render/editability classification
bun test app/features/render/parseRenderGraph.test.ts

# WS patch surface + RPC validation
bun test app/ws/filePatcher.test.ts app/ws/methods.test.ts

# UI routing and command execution
bun test app/components/GraphCanvas.test.tsx app/components/editor/WorkspaceClient.test.tsx

# History, rollback, conflict guards
bun test app/store/graph.test.ts app/hooks/useFileSync.test.ts

# Layout regression guard
bun test app/hooks/useLayout.test.ts

# Optional focused node editor tests
bun test app/components/nodes/MarkdownNode.test.tsx app/components/nodes/ShapeNode.test.tsx app/components/nodes/StickyNode.test.tsx
```

## 5) 수동 검증 시나리오

1. absolute node를 드래그하고 TSX diff가 `x`,`y`만 포함하는지 확인한다.
2. attach decoration을 이동하고 `gap` 또는 `at.offset`만 바뀌는지 확인한다.
3. Text/Markdown 노드를 수정하고 content carrier surface만 바뀌는지 확인한다.
4. 기존 style UI(예: Sticker Inspector, Washi preset)를 사용해 whitelist field만 저장되는지 확인한다.
5. rename을 수행하고 `from/to/anchor` 참조가 유지되는지 확인한다.
6. Canvas 빈 공간에서 Shape/Text/Markdown 생성이 저장되고 즉시 렌더되는지 확인한다.
7. MindMap 노드에서 자식/형제 추가가 올바른 구조로 저장되는지 확인한다.
8. MindMap parent change가 성공/실패(cycle) 모두 예측 가능하게 동작하는지 확인한다.
9. 충돌을 유도해 rollback과 재동기화 메시지를 확인한다.
10. 각 command 후 undo/redo가 1-step 이벤트 단위로 동작하는지 확인한다.
11. 생성 직후 새 노드가 selection handoff로 선택되는지 확인한다.
12. rename/create/reparent undo/redo 시 전체 re-render 없이 stale selection이 남지 않는지 확인한다.

## 6) 정량 검증 기준

- SC-001: 위치 이동 회귀 95%+에서 위치 관련 필드만 변경
- SC-002: 콘텐츠 편집 회귀 95%+에서 콘텐츠 관련 surface만 변경
- SC-003: 생성 시나리오 95%+에서 유효 TSX 저장 + 즉시 렌더
- SC-004: reparent 성공/거부 정확도 99%+/100%
- SC-005: 실패 시 부분 반영 0건
- SC-006: undo/redo 이벤트 단위 정확도 99%+
- SC-007: quickstart 수동 검증의 연속 세션 10회 중 9회 이상에서 수동 TSX 편집이나 임시 복구 단계 없이 완료
- SC-008: 스타일 편집 회귀 95%+에서 허용된 스타일 필드만 변경

## 7) 실행 노트

- semantic command는 초기 구현에서 기존 RPC 위의 client-side abstraction으로 시작한다.
- `editMeta`는 가능하면 `parseRenderGraph.ts`에서 계산하고, render HTTP contract 변경은 최후 수단으로 둔다.
- 기존 workspace 전체 테스트에 unrelated failure가 있으면 scoped test set을 우선 통과시킨다.
- `node.delete`는 현재 create undo/replay를 위한 internal inverse RPC로만 사용한다.
