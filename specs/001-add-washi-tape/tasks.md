# Tasks: Washi Tape Object

**Input**: Design documents from `/Users/danghamo/Documents/gituhb/magam-washi-tape/specs/001-add-washi-tape/`  
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: 스펙에 독립 테스트 기준과 내보내기 일관성 검증이 명시되어 있으므로 사용자 스토리별 테스트 작업을 포함한다.

**Organization**: 사용자 스토리별 독립 구현/검증이 가능하도록 Phase를 분리한다.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 와시 테이프 구현을 위한 파일/타입 골격 준비

- [X] T001 와시 테이프 신규 파일 스켈레톤 생성 in `libs/core/src/components/WashiTape.tsx`, `app/components/nodes/WashiTapeNode.tsx`, `app/utils/washiTapeDefaults.ts`, `app/utils/washiTapeGeometry.ts`, `app/utils/washiTapePattern.ts`
- [X] T002 [P] 와시 테이프 테스트 스켈레톤 생성 in `libs/core/src/__tests__/washi-tape.spec.tsx`, `app/utils/washiTapePattern.test.ts`, `app/utils/washiTapeGeometry.test.ts`, `app/components/nodes/WashiTapeNode.test.tsx`
- [X] T003 [P] React Flow 와시 노드 스타일 베이스 추가 in `app/app/globals.css`
- [X] T004 와시 노드 데이터 타입 선언 및 import 연결 in `app/types/washiTape.ts`, `app/components/nodes/WashiTapeNode.tsx`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 모든 사용자 스토리의 공통 기반(타입 파이프라인/계약/동기화) 구축

**⚠️ CRITICAL**: 이 단계 완료 전에는 사용자 스토리 구현을 시작하지 않는다.

- [X] T005 코어 `WashiTape` host 컴포넌트 구현 및 export 연결 in `libs/core/src/components/WashiTape.tsx`, `libs/core/src/index.ts`
- [X] T006 `graph-washi-tape` 파서 분기와 기본 sourceMeta 매핑 추가 in `app/app/page.tsx`
- [X] T007 `washi-tape` React Flow node type 등록 및 스토어 기본 필드 반영 in `app/components/GraphCanvas.tsx`, `app/store/graph.ts`
- [X] T008 WS 편집 계약에 `washi-tape` 타입 추가 in `app/ws/methods.ts`, `app/ws/filePatcher.ts`
- [X] T009 [P] WS 계약 회귀 테스트 추가 in `app/ws/methods.test.ts`, `app/ws/filePatcher.test.ts`
- [X] T010 [P] HTTP 렌더 sourceMeta 주입 대상에 와시 타입 포함 in `libs/cli/src/server/http.ts`

**Checkpoint**: 공통 파이프라인 준비 완료 - 사용자 스토리 구현 시작 가능

---

## Phase 3: User Story 1 - 빠른 강조 라벨 생성 (Priority: P1) 🎯 MVP

**Goal**: 프리셋 기반 와시 테이프를 단일 오브젝트로 삽입하고 save/reopen 시 동일 상태를 유지한다.

**Independent Test**: 프리셋+텍스트 와시 테이프 1개 삽입 후 재열기해 스타일/배치/콘텐츠 보존을 확인한다.

### Tests for User Story 1

- [X] T011 [P] [US1] `graph-washi-tape` 기본 렌더 + 내장 `PresetPattern` 카탈로그 노출 계약 테스트 작성 in `libs/core/src/__tests__/washi-tape.spec.tsx`
- [X] T012 [P] [US1] 삽입/재열기 보존 회귀 테스트 작성 in `app/store/graph.test.ts`, `app/utils/clipboardGraph.test.ts`

### Implementation for User Story 1

- [X] T013 [US1] 내장 `PresetPattern` 카탈로그 + 프리셋/텍스트/투명도 기본값 정규화 구현 in `app/utils/washiTapeDefaults.ts`
- [X] T014 [US1] 프리셋 ID 기반 스타일 해석 + 텍스트 오버레이 렌더 구현 in `app/components/nodes/WashiTapeNode.tsx`
- [X] T015 [US1] parser에서 preset sugar/프리셋 ID 및 콘텐츠 추출 매핑 구현 in `app/app/page.tsx`
- [X] T016 [US1] toolbar 와시 프리셋 버튼/목록 노출 경로 연결 in `app/components/FloatingToolbar.tsx`, `app/hooks/useFileSync.ts`
- [X] T017 [US1] 저장/재열기 안전성을 위한 washi 필드 patch 처리 구현 in `app/ws/filePatcher.ts`

**Checkpoint**: US1 단독으로 기능 동작 및 검증 가능(MVP)

---

## Phase 4: User Story 2 - 브랜드 맞춤 테이프 스타일 적용 (Priority: P2)

**Goal**: solid/svg/image 커스텀 패턴과 fallback 정책을 제공한다.

**Independent Test**: 서로 다른 커스텀 패턴 3종을 적용하고 invalid 입력 시 fallback 렌더를 확인한다.

### Tests for User Story 2

- [X] T018 [P] [US2] 패턴 유니온 파싱/검증/fallback 단위 테스트 작성 in `app/utils/washiTapePattern.test.ts`
- [X] T019 [P] [US2] 커스텀 패턴 렌더 케이스 테스트 작성 in `app/components/nodes/WashiTapeNode.test.tsx`

### Implementation for User Story 2

- [X] T020 [US2] solid/svg/image 패턴 파서 및 fallback 정책 구현 in `app/utils/washiTapePattern.ts`
- [X] T021 [US2] SVG allowlist sanitize 및 inline 렌더 경로 구현 in `app/components/nodes/WashiTapeNode.tsx`
- [X] T022 [US2] parser에 `pattern`, `edge`, `texture`, `text` props 매핑 추가 in `app/app/page.tsx`
- [X] T023 [US2] 와시 노드 스타일 전환 quick action/command 경로 연결 in `app/components/FloatingToolbar.tsx`, `app/components/ui/QuickOpenDialog.tsx`
- [X] T024 [US2] WS patch 경로에서 커스텀 패턴 필드 허용 확장 in `app/ws/filePatcher.ts`, `app/ws/methods.ts`

**Checkpoint**: US1 + US2 각각 독립 검증 가능

---

## Phase 5: User Story 3 - 정밀 배치 및 내보내기 일관성 확보 (Priority: P3)

**Goal**: segment/polar/attach 배치 정규화와 export 시각 일관성을 제공한다.

**Independent Test**: 3개 배치 모드별 렌더 + attach 추적 + PNG/JPEG/SVG/PDF 내보내기 일치 여부를 확인한다.

### Tests for User Story 3

- [X] T025 [P] [US3] segment/polar/attach 정규화 + jitter 결정성 테스트 작성 in `app/utils/washiTapeGeometry.test.ts`
- [X] T026 [P] [US3] export 포맷별 props 보존/시각 회귀 테스트 작성 in `libs/core/src/__tests__/washi-tape.spec.tsx`, `app/utils/pdfGolden.test.ts`

### Implementation for User Story 3

- [X] T027 [US3] 배치 입력(`segment/polar/attach`)을 공통 geometry로 정규화 구현 in `app/utils/washiTapeGeometry.ts`
- [X] T028 [US3] attach 대상 추적 및 geometry 적용 파서 통합 구현 in `app/app/page.tsx`, `app/utils/anchorResolver.ts`
- [X] T029 [US3] `angle` 미지정 시 결정적 jitter 계산 구현 in `app/utils/washiTapeGeometry.ts`, `app/utils/stickerJitter.ts`
- [X] T030 [US3] geometry/edge/texture/text overflow 렌더 로직 완성 in `app/components/nodes/WashiTapeNode.tsx`
- [X] T031 [US3] 키보드 삽입/선택/포커스 흐름에 와시 타입 반영 in `app/components/GraphCanvas.tsx`, `app/store/graph.ts`
- [X] T032 [US3] sourceMeta/export 경로에서 washi 타입 전달 보장 in `libs/cli/src/server/http.ts`, `app/hooks/useExportImage.ts`

**Checkpoint**: US3 단독 검증 포함 전체 스토리 완료

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 문서화/회귀 안정화/최종 검증

- [X] T033 [P] 구현 반영 문서 업데이트 in `docs/features/washi-tape/README.md`
- [X] T034 [P] 아키텍처 결정 기록(계약/범위/회귀 원칙) 업데이트 in `docs/adr/ADR-0001-washi-tape-api-design.md`
- [X] T035 quickstart 검증 명령 실행 결과 반영 in `specs/001-add-washi-tape/quickstart.md`
- [X] T036 신규 와시 관련 파일 디버그/린트 정리 in `app/components/nodes/WashiTapeNode.tsx`, `app/utils/washiTapeDefaults.ts`, `app/utils/washiTapeGeometry.ts`, `app/utils/washiTapePattern.ts`, `libs/core/src/components/WashiTape.tsx`

---

## Dependencies & Execution Order

### Phase Dependencies

- Setup (Phase 1) -> Foundational (Phase 2) -> User Story Phases (Phase 3, 4, 5) -> Polish (Phase 6)
- 사용자 스토리 작업은 모두 Phase 2 완료 이후 시작한다.

### User Story Dependencies

- **US1 (P1)**: Foundational 이후 즉시 시작 가능, MVP 범위.
- **US2 (P2)**: Foundational 이후 시작 가능, US1 완료 없이도 독립 구현/검증 가능.
- **US3 (P3)**: Foundational 이후 시작 가능, US1/US2와 독립 검증 가능.

### Within Each User Story

- 테스트 작업 -> 핵심 구현 -> 통합/회귀 순으로 진행한다.
- `[P]` 태스크는 서로 다른 파일을 수정하므로 병렬 수행 가능하다.

---

## Parallel Execution Examples

### User Story 1

```bash
Task: "T011 [US1] libs/core/src/__tests__/washi-tape.spec.tsx 테스트 작성"
Task: "T012 [US1] app/store/graph.test.ts + app/utils/clipboardGraph.test.ts 회귀 테스트 작성"
```

### User Story 2

```bash
Task: "T018 [US2] app/utils/washiTapePattern.test.ts 테스트 작성"
Task: "T019 [US2] app/components/nodes/WashiTapeNode.test.tsx 렌더 테스트 작성"
```

### User Story 3

```bash
Task: "T025 [US3] app/utils/washiTapeGeometry.test.ts 테스트 작성"
Task: "T026 [US3] libs/core/src/__tests__/washi-tape.spec.tsx + app/utils/pdfGolden.test.ts 회귀 테스트 작성"
```

---

## Implementation Strategy

### MVP First (US1)

1. Phase 1~2 완료
2. Phase 3(US1) 완료
3. US1 독립 테스트 통과 후 MVP 데모/검증

### Incremental Delivery

1. US1(빠른 생성/보존) -> 배포 가능 단위
2. US2(커스텀 패턴) -> 디자인 확장 단위
3. US3(정밀 배치/내보내기) -> 생산성/품질 완성 단위

### Parallel Team Strategy

1. 팀 전체가 Phase 1~2를 완료
2. 이후 개발자를 US1/US2/US3로 분산
3. 공통 회귀 테스트는 Phase 6에서 통합 검증

---

## Notes

- 모든 태스크는 체크박스 + Task ID + (필요 시 `[P]`, `[US#]`) + 파일 경로 형식을 따른다.
- 사용자 스토리별 태스크가 독립 검증 가능하도록 설계되었다.
- 권장 MVP 범위는 **US1(Phase 3)** 이다.
