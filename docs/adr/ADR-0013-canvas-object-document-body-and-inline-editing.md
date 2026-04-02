---
title: ADR-0013 Canvas Object Document Body and Object-Level Inline Editing
date: 2026-03-31
status: accepted
authors:
  - platform-team
tags:
  - adr
  - architecture
  - canvas
  - editor
  - document
  - tiptap
aliases:
  - Canvas document body ADR
  - Object-level inline editing ADR
  - Tiptap body source of truth ADR
---

# ADR-0013: Adopt Tiptap Document Body and Object-Level Inline Editing for Native Canvas Objects

## Context

Magam의 canvas-first MVP는 오브젝트를 카드 위젯 묶음이 아니라 캔버스 위의 직접 편집 가능한 의미 단위로 다뤄야 한다.

하지만 기존 native object authoring 경로는 이 방향과 어긋나는 지점이 있었다.

- 오브젝트 본문은 `markdown string` 또는 `contentBlocks[]` 기반으로 분절 저장되었다.
- 본문 편집은 "markdown block 추가/수정" 흐름에 가까웠고, 연속적인 문서 입력 흐름이 아니었다.
- preview와 edit 모두 block 경계를 강하게 드러내어 캔버스 위 object body가 문서처럼 느껴지지 않았다.
- `MARKDOWN`, `Remove`, `Select a block to insert after it` 같은 캔버스용 액션 카피와 block 삽입 affordance가 editor model보다 block tool UI를 먼저 드러냈다.
- sticky, text, shape, frame 같은 native object가 공통의 body contract를 갖지 않아 interaction/runtime/projection 경계가 분산되었다.

이 구조는 다음 제품 요구와 긴장 관계를 만든다.

1. 사용자는 선택 직후 곧바로 문서처럼 타이핑을 이어갈 수 있어야 한다.
2. `/` slash command로 현재 위치의 block transform/insert를 수행해야 한다.
3. native canvas object는 모두 공통의 document body 경계를 가져야 한다.
4. preview는 조용해야 하고, edit는 현재 block에만 약한 focus surface를 보여야 한다.
5. AI, runtime, editor UI는 같은 canonical body payload를 읽고 써야 한다.

ADR-0005는 database-first canvas platform을 채택했고, ADR-0006은 shared canonical contract를 lower stable layer로 끌어내렸다. 이제 native object body 자체의 canonical 표현과 편집 모델도 같은 수준으로 고정해야 한다.

## Decision Drivers

- document-first authoring for canvas objects
- single source of truth for body content
- shared runtime/editor/AI contract
- simpler object editing mental model
- quiet preview and canvas-native edit affordances
- migration path from legacy block and markdown data

## Decision

Magam은 native editable canvas object의 본문 source of truth를 `Tiptap document JSON`으로 통일하고, 편집 모델을 `object-level inline document editor`로 재정의한다.

구체적으로는 다음을 채택한다.

1. native editable object body는 `body` + `bodySchemaVersion`으로 저장한다.
2. `body`는 markdown string이나 persisted block array가 아니라 Tiptap `doc` JSON을 canonical payload로 사용한다.
3. `sticky`, `text`, `shape`, `frame`, `image`는 모두 기본적으로 document body를 가진다.
4. canvas editor는 object 하나당 하나의 연속 문서 편집기를 사용하고, persisted block id를 저장하지 않는다.
5. 본문 쓰기 경로의 canonical command는 `object.body.replace`다.
6. `object.content.update`와 `object.body.block.*`는 compatibility adapter로만 유지하고, 내부적으로는 `body`를 read/transform/write 한다.
7. preview는 block chrome을 숨기고, edit에서는 현재 selection이 포함된 top-level block에만 subtle focus surface를 적용한다.
8. block insert/transform UX는 별도 캔버스 버튼이 아니라 slash command를 기본 경로로 사용한다.

## Decision Details

### Canonical Body Contract

- canonical body field는 `body`다.
- schema version field는 `bodySchemaVersion`이다.
- canonical document payload는 Tiptap `doc` JSON 구조를 따른다.
- phase 1 지원 top-level node는 다음으로 제한한다.
  - `paragraph`
  - `heading` (`level` 1-3)
  - `bulletList`
  - `orderedList`
  - `taskList`
  - `blockquote`
  - `codeBlock`
  - `horizontalRule`
  - `image`
- phase 1 지원 marks는 다음으로 제한한다.
  - `bold`
  - `italic`
  - `strike`
  - `code`
  - `link`

### Object Scope and Seeding

- 다음 native editable object는 모두 body-backed object로 본다.
  - `sticky`
  - `text`
  - `shape`
  - `frame`
  - `image`
- `sticky`, `text`, `shape`, `frame`는 기본적으로 빈 paragraph 하나로 seed한다.
- `image`는 `[image node, empty paragraph]`로 seed한다.
- empty editable object라도 body가 없는 상태는 canonical path로 허용하지 않는다.

### Derived Content Rules

- migrated body-backed object의 `primaryContentKind`는 `document`다.
- `canonicalText`는 Tiptap JSON을 document order로 순회해 derive한다.
- `image` node는 `alt`를 우선 반영하고 필요 시 `title`을 이어서 반영한다.
- `horizontalRule`은 `canonicalText`에 기여하지 않는다.
- persisted `contentBlocks`와 legacy markdown string은 canonical output이 아니라 compatibility input으로만 남는다.

### Runtime and Projection Contract

- canonical body write path는 `object.body.replace`다.
- editing projection은 `body`, `bodySource`, `preferredCommandName: 'object.body.replace'`를 노출한다.
- `bodySource`는 `native` 또는 `legacy-converted`만 허용한다.
- persisted block id는 더 이상 canonical persistence나 editing projection 계약에 포함하지 않는다.
- top-level block 개념은 persisted entity가 아니라 document body에서 derive되는 UI 개념이다.

### Editor Model

- canvas editor는 object-level rich text editor를 사용한다.
- 오브젝트 내부 본문은 “markdown block 하나 추가”가 아니라 처음부터 연속적인 문서 편집처럼 동작한다.
- global editor store는 coarse body editor state만 가진다.
  - active editor object id
  - editor open state
  - transient draft session
- caret position, active block, slash query, local undo/redo는 Tiptap editor session이 소유한다.
- selection first rule을 채택한다.
  - 첫 클릭은 object selection만 수행한다.
  - 이미 선택된 object를 다시 상호작용할 때만 body edit로 진입한다.
- edit exit는 commit-aware path로 통일한다.
  - blur
  - selecting another object
  - opening context or floating controls
  - starting transform
  - pressing `Escape`

### Slash Command UX

- slash command는 body editor 내부에서 `/`로 진입한다.
- trigger는 block 시작점 또는 leading whitespace 뒤의 `/`에 한정한다.
- 메뉴는 object 내부 caret 위치에 anchor된다.
- keyboard navigation, `Enter` apply, `Escape` dismiss, query filtering을 지원한다.
- phase 1 command set은 다음으로 고정한다.
  - `Text`
  - `Heading 1`
  - `Heading 2`
  - `Heading 3`
  - `Bulleted List`
  - `Numbered List`
  - `Checklist`
  - `Quote`
  - `Code Block`
  - `Divider`
  - `Image`

### Preview and Visual Rules

- preview는 shared static document renderer를 사용한다.
- preview에서는 block boundary background, shell, action chrome을 표시하지 않는다.
- edit 중에는 현재 selection이 포함된 top-level block만 내용 크기에 맞는 subtle background/focus surface를 표시한다.
- 이전의 canvas block action copy는 제거한다.
  - `MARKDOWN`
  - `Remove`
  - `Select a block to insert after it`

### Sticky Notes

- sticky는 카드가 아니라 vivid post-it paper visual로 렌더링한다.
- 기본 fill preset은 saturated `amber` 계열을 사용한다.
- rounded fold 대신 sharp right-angle folded corner를 사용한다.
- 기존 우측 상단 decorative accent는 제거한다.
- 하단 끝에는 contact shadow와 soft float shadow를 함께 사용해 종이가 떠 있는 느낌을 만든다.

## Alternatives Considered

### A. Keep Markdown String and Improve the Existing Block Editor

- 장점: 현재 코드 경로를 부분적으로 재사용할 수 있다.
- 장점: 텍스트 기반 inspectability가 단순해 보일 수 있다.
- 단점: object body가 문서가 아니라 block list patch 대상으로 남는다.
- 단점: slash command, active block decoration, selection-first inline editing을 일관되게 구현하기 어렵다.
- 단점: runtime과 editor가 shared document contract를 갖지 못한다.
- 결론: 비채택

### B. Persist Tiptap JSON but Keep Block IDs and Canvas Add Buttons

- 장점: migration 중 기존 UI affordance를 일부 유지할 수 있다.
- 장점: block-level commands를 익숙한 방식으로 드러낼 수 있다.
- 단점: persisted block entity와 document model이 이중화된다.
- 단점: preview가 계속 noisy해지고 canvas 문맥보다 block tool UI가 앞선다.
- 단점: active block이 selection-derived UI state라는 점을 흐리게 만든다.
- 결론: 비채택

### C. Tiptap Document Body + Object-Level Inline Editing (Selected)

- 장점: 저장 계약, runtime command, projection, editor behavior가 하나의 document model로 정렬된다.
- 장점: 노션형 텍스트 흐름과 slash command를 canvas 문맥에 맞게 제공할 수 있다.
- 장점: preview를 더 조용하게 유지하면서 edit focus는 현재 block에만 집중시킬 수 있다.
- 장점: native object 전반에 공통 body contract를 적용할 수 있다.
- 단점: legacy markdown/contentBlocks migration과 adapter 유지 비용이 생긴다.
- 결론: 최종 채택

## Consequences

### Positive

- native editable object가 같은 body contract를 공유한다.
- editor/runtime/AI가 같은 canonical body payload를 읽고 쓴다.
- block editor에서 document editor로 mental model이 단순해진다.
- preview와 edit의 역할 분리가 더 명확해진다.
- slash command와 active block decoration을 자연스럽게 수용할 수 있다.

### Negative

- raw markdown inspectability는 canonical storage 기준으로 약해진다.
- legacy block-based UI와 command surface를 adapter로 관리해야 한다.
- migration, validation, body normalization 규칙이 더 중요해진다.
- Tiptap schema와 editor session lifecycle이 editor correctness의 핵심 인프라가 된다.

## Follow-up

1. shared canonical body validator와 migration helper는 이 ADR의 node/mark 제한을 기준으로 유지한다.
2. canvas runtime projection과 command docs는 `object.body.replace`를 primary path로 반영해야 한다.
3. editor interaction regression test는 selection-first entry, blur commit, context/floating menu commit을 계속 검증해야 한다.
4. sticky visual contract는 `DESIGN.md`와 함께 유지해 implementation drift를 막아야 한다.
5. legacy `contentBlocks` persistence와 markdown-specific authoring code는 transition window 이후 제거 계획을 별도로 정리해야 한다.

## Related Decisions

- ADR-0005: database-first canvas platform의 상위 저장 방향을 정의한다.
- ADR-0006: shared canonical contract extraction과 lower-layer ownership을 정의한다.
- ADR-0012: workspace-scoped database와 canvas-first shell 방향을 정의한다.
