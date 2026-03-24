# Node Create 구현 계획서

## Implementation Alignment (2026-03-24)

- Phase 1~4 MVP는 shared canonical mutation/executor/repository path 기준으로 구현한다.
- `canvas.node.create`와 `object.body.block.insert`는 canonical mutation이 primary이며, current compatibility shell projection은 reload/render continuity를 위한 secondary path로만 유지한다.
- `floating-action-menu` 확장은 이 계획 범위 밖이다.

## 1. 문서 목적

이 문서는 `node-create/README.md`의 설계 방향을 실제 구현 순서로 압축한 실행 계획이다.

- 기준 문서: `docs/features/m2/canvas-editor/node-create/README.md`
- 설계 초안 계약: `docs/features/m2/canvas-editor/node-create/canvas-node-body-contract.ts`
- 상위 방향: `docs/adr/ADR-0005-database-first-canvas-platform.md`

핵심은 `CanvasNode 생성`을 더 이상 `ws/filePatcher` 중심으로 구현하지 않고, canonical mutation path 위에서 `mindmap-first`로 닫는 것이다.

## 2. 구현 원칙

1. 첫 vertical slice는 `mindmap root / child / sibling create`다.
2. create는 반드시 canonical revision path를 탄다.
3. body-capable node는 생성 시 기본 markdown WYSIWYG block 하나를 seed한다.
4. `canvas_nodes`는 shell/composition만 소유하고, body truth는 canonical object가 소유한다.
5. `plugin node`와 `plugin block`은 첫 milestone에서 합치지 않는다.
6. legacy TSX create path는 compatibility fallback으로만 남긴다.
7. floating menu는 node-level과 block-level로 분리한다.

## 3. 현재 구현 기준점

### 이미 있는 것

- UI create intent
  - `app/components/GraphCanvas.tsx`
  - `app/processes/canvas-runtime/bindings/graphCanvasHost.ts`
- action routing vocabulary
  - `node.create`
  - `mindmap.child.create`
  - `mindmap.sibling.create`
- canonical persistence/query baseline
  - `libs/shared/src/lib/canonical-persistence/*`
  - `libs/shared/src/lib/canonical-query/*`
- canonical mutation baseline
  - `object.content.update`
  - `object.body.*`
  - `canvas.node.move`
  - `canvas.node.reparent`

### 없는 것

- `canvas.node.create` mutation operation
- create executor branch
- body seed를 포함한 native create service
- mindmap create를 canonical mutation으로 라우팅하는 UI path
- slash command body insert surface

## 4. 대상 결과물

첫 milestone이 끝났을 때 기대하는 결과:

1. mindmap root/child/sibling 생성이 canonical mutation으로 동작한다.
2. 새 mindmap node는 기본 markdown body block 하나를 가진다.
3. 생성 직후 markdown WYSIWYG 편집으로 바로 진입할 수 있다.
4. `mindmap.child.create`, `mindmap.sibling.create`는 더 이상 file patch primary path를 사용하지 않는다.
5. node-level floating menu와 block-level floating menu의 책임이 분리된다.

## 5. 구현 범위 분해

## Phase 0. 계약 고정

목표:

- 구현 전에 create contract와 body seed contract를 코드 초안 수준으로 고정한다.

작업:

1. `canvas.node.create` payload shape 확정
2. body-capable profile 확정
3. 기본 markdown block seed 규칙 확정
4. mindmap child/sibling placement normalization 규칙 확정
5. node-level / block-level floating menu responsibility 확정

수정 범위:

- `docs/features/m2/canvas-editor/node-create/README.md`
- `docs/features/m2/canvas-editor/node-create/canvas-node-body-contract.ts`

종료 기준:

- executor 구현에 필요한 필드가 더 이상 애매하지 않다.

## Phase 1. canonical mutation core에 create 추가

목표:

- `canvas.node.create`를 canonical mutation 계층의 정식 operation으로 추가한다.

작업:

1. `libs/shared/src/lib/canonical-mutation/types.ts`
  - `CanvasNodeCreateOperation` 추가
2. `libs/shared/src/lib/canonical-mutation/executor.ts`
  - create branch 추가
3. create helper 분리
  - `createNativeCanvasNode()`
  - 이후 plugin/binding-proxy 확장 가능하도록 구조만 열기
4. repository helper 보강
  - `createCanvasNode()` 재사용
  - 필요 시 canonical object create/upsert helper 조합

수정 범위:

- `libs/shared/src/lib/canonical-mutation/types.ts`
- `libs/shared/src/lib/canonical-mutation/executor.ts`
- `libs/shared/src/lib/canonical-mutation/*`
- `libs/shared/src/lib/canonical-persistence/repository.ts`

종료 기준:

- dry-run 포함 `canvas.node.create`가 headless mutation executor에서 동작한다.
- create 후 revision append와 changed-set reporting이 일관된다.

## Phase 2. mindmap native create vertical slice

목표:

- UI에서 mindmap root/child/sibling create를 canonical mutation으로 연결한다.

작업:

1. action routing payload 정렬
  - `mindmap.child.create`
  - `mindmap.sibling.create`
  - root create path
2. create request를 canonical payload로 normalize
3. parent/sibling scope validation 추가
4. create 후 optimistic UI patch와 canonical reload 경계 정리

수정 범위:

- `app/features/editing/actionRoutingBridge/*`
- `app/features/editing/commands.ts`
- `app/features/editor/pages/CanvasEditorPage.tsx`
- 필요 시 `app/processes/canvas-runtime/bindings/actionDispatch.ts`

종료 기준:

- mindmap child/sibling create가 editor에서 동작한다.
- 실패 시 optimistic rollback과 에러 surface가 유지된다.

## Phase 3. 기본 body seed + 즉시 편집 진입

목표:

- body-capable mindmap node가 생성 즉시 markdown block 1개를 가진다.

작업:

1. native create helper에서 body-capable node seed 적용
2. 첫 block은 markdown WYSIWYG 기반으로 생성
3. 생성 직후 편집 focus 진입 연결
4. 현재 markdown-first edit mode와 충돌 없는지 정리
5. node-level floating menu에서 body default font size / text align 연결

수정 범위:

- `libs/shared/src/lib/canonical-mutation/*`
- `libs/shared/src/lib/canonical-persistence/validators.ts`
- `app/components/editor/workspaceEditUtils.ts`
- `app/components/GraphCanvas.tsx`
- 관련 node renderer / body resolver

종료 기준:

- 새 mindmap node를 만들면 빈 markdown body가 즉시 편집 가능 상태로 열린다.
- node-level floating menu에서 공용 typography defaults를 바꿀 수 있다.

## Phase 4. slash command 기반 block insert

목표:

- `/` 커맨드가 create가 아니라 body mutation surface로 동작하게 만든다.

작업:

1. slash command inventory 정의
2. `/markdown`, `/image` 기본 command 연결
3. `object.body.block.insert` mutation path 사용
4. block insert 후 selection/focus/scroll behavior 정리
5. block-level floating menu에서 현재 markdown block override 연결

수정 범위:

- body editor feature files
- `libs/shared/src/lib/canonical-mutation/types.ts`
- `libs/shared/src/lib/canonical-mutation/executor.ts`
- UI command palette or editor slash handler

종료 기준:

- body-capable node 안에서 slash command로 block 추가가 가능하다.
- active markdown block에서 block-level floating menu override가 가능하다.

## Phase 5. generic native create 확장

목표:

- mindmap 전용 경로를 generic body-capable native node로 확장한다.

작업:

1. text/sticky/shape create를 같은 canonical path로 수렴
2. `canvas-absolute` create와 `mindmap-*` create를 같은 contract 아래 정리
3. generic create affordance를 toolbar/pane menu에 확장

수정 범위:

- `app/components/GraphCanvas.tsx`
- `app/features/canvas-ui-entrypoints/**`
- `app/features/editing/actionRoutingBridge/*`
- `libs/shared/src/lib/canonical-mutation/*`

종료 기준:

- body-capable native node create가 하나의 canonical contract 위에 정리된다.

## Phase 6. legacy TSX create 격리

목표:

- primary create path에서 `filePatcher`를 제거한다.

작업:

1. `CanvasEditorPage` create dispatch에서 legacy mutation descriptor 의존 제거
2. `app/ws/methods.ts` / `app/ws/filePatcher.ts`의 create path를 compatibility 용도로만 유지
3. editability/permission에서 file-first create를 primary로 노출하지 않음

수정 범위:

- `app/features/editor/pages/CanvasEditorPage.tsx`
- `app/ws/methods.ts`
- `app/ws/filePatcher.ts`
- 관련 테스트

종료 기준:

- primary editor create는 canonical mutation path만 사용한다.

## 6. 작업 레인

### Lane A. canonical mutation

- `libs/shared/src/lib/canonical-mutation/*`
- `libs/shared/src/lib/canonical-persistence/*`

책임:

- create operation
- body seed
- revision append

### Lane B. editor routing

- `app/features/editing/*`
- `app/features/editor/pages/CanvasEditorPage.tsx`

책임:

- intent normalization
- canonical mutation dispatch
- optimistic handling

### Lane C. node body UX

- body editor
- markdown WYSIWYG integration
- slash command handling

책임:

- 생성 직후 편집 진입
- block insert UX

### Lane D. floating menu UX

- node-level floating menu
- block-level floating menu
- 후속 inline text toolbar

책임:

- 공용 typography defaults 노출
- 현재 block override 노출
- menu priority와 dismiss 규칙 정리

## 7. 리스크와 대응

1. create와 body mutation 경계가 다시 섞일 위험
- 대응: create는 initial seed까지만, 이후 추가 block은 항상 `object.body.block.*`

2. mindmap placement와 absolute placement가 같은 branch에서 복잡하게 얽힐 위험
- 대응: 첫 milestone은 `mindmap-*` 전용 path를 먼저 닫고, generic create는 이후 확장

3. node body truth가 `canvas_nodes.props`로 새는 위험
- 대응: validator와 mapping에서 body payload 금지 규칙 유지

4. plugin node와 plugin block 개념이 섞일 위험
- 대응: Phase 1~4에서는 plugin block을 namespaced block contract 수준으로만 유지

5. node-level 메뉴와 block-level 메뉴의 책임이 섞일 위험
- 대응: node-level은 defaults, block-level은 override만 수정하도록 초기에 강하게 제한

## 8. 검증 계획

### 단위/계약 테스트

1. `canvas.node.create` validation
2. body-capable node default seed
3. mindmap child/sibling parent resolution
4. revision conflict precondition
5. node-level style defaults와 block-level override 해석 우선순위

### 통합 테스트

1. mindmap root create
2. mindmap child create
3. mindmap sibling create
4. 생성 직후 markdown editor focus
5. slash command block insert
6. node-level floating menu defaults 적용
7. block-level floating menu override 적용

### 회귀 체크

1. `canvas.node.move`
2. `canvas.node.reparent`
3. 기존 markdown-first body edit session
4. legacy compatibility open/render path

## 9. 완료 정의

다음이 만족되면 구현 계획의 1차 목표가 완료된 것으로 본다.

1. mindmap root/child/sibling create가 canonical mutation으로 동작한다.
2. body-capable mindmap node는 생성 시 markdown block 하나를 seed한다.
3. 생성 직후 markdown WYSIWYG 편집으로 진입한다.
4. `/` slash command가 최소 markdown/image block insert를 지원한다.
5. node-level floating menu는 공용 typography defaults를 수정한다.
6. block-level floating menu는 현재 markdown block override만 수정한다.
7. primary create path가 더 이상 `filePatcher`를 canonical write path로 사용하지 않는다.
