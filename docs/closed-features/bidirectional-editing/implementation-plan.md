# Bidirectional Editing Implementation Plan (Ticket-aligned)

기준 문서:
- PRD: `docs/features/bidirectional-editing/README.md`

목표:
- v1 범위(자유 배치/앵커/마크다운/id 편집/생성/부모변경)를 실제 구현 가능한 티켓으로 분해
- 의존성/완료 기준/검증 방법을 명확히 정의

---

## 1. 트랙 구성

- **Track A — Render/Meta (기반)**
  - `/render` 버전 메타
  - 노드 sourceMeta 주입
  - 클라이언트 store 메타 확장

- **Track B — RPC/Server (편집 명령 처리)**
  - `node.move`, `node.update`, `node.create`, `node.reparent`
  - 버전 충돌/에러코드/알림 스키마

- **Track C — AST Patcher (코드 반영 엔진)**
  - 위치/속성/생성/reparent/cycle 처리

- **Track D — Canvas UX (클라이언트 인터랙션)**
  - 드래그/수정/생성/reparent UX
  - optimistic + rollback

- **Track E — 안정화/테스트**
  - 단위/통합/수동 시나리오
  - 회귀/성능/오류 메시지

---

## 2. 선행 고정 계약 (Contract Freeze)

아래 4개를 먼저 고정한 후 병렬 착수:

1) `file.changed` notification payload
- `{ filePath, version, originId, commandId, timestamp }`

2) 공통 RPC params
- `{ filePath, baseVersion, originId, commandId }`

3) 오류코드
- `40001 INVALID_PARAMS`
- `40401 NODE_NOT_FOUND`
- `40901 VERSION_CONFLICT`
- `40902 MINDMAP_CYCLE`
- `50001 PATCH_FAILED`

4) sourceMeta shape
- `{ sourceId, kind: 'canvas'|'mindmap', scopeId? }`

---

## 3. 티켓 백로그

## P0 — 기반/계약

### BIDI-001: Render version 메타 추가
- Priority: P0
- Track: A
- Depends On: 없음
- Scope:
  - `libs/cli/src/server/http.ts` `/render` 응답에 `sourceVersion` 추가(파일 해시)
- DoD:
  - `/render` 응답에 `sourceVersion` 존재
  - 기존 렌더 응답과 호환 유지

### BIDI-002: Node sourceMeta 주입
- Priority: P0
- Track: A
- Depends On: BIDI-001
- Scope:
  - 렌더 노드 `data`에 `sourceMeta` 삽입
- DoD:
  - 노드마다 `sourceId`/`kind` 확인 가능

### BIDI-003: Graph store 메타 확장
- Priority: P0
- Track: A
- Depends On: BIDI-001
- Scope:
  - `app/store/graph.ts`에 `sourceVersion`, `clientId`, `lastAppliedCommandId` 추가
- DoD:
  - 렌더 수신 시 `sourceVersion` 반영
  - `clientId` 세션 생성 시 1회 고정

### BIDI-004: RPC/에러/알림 계약 문서 고정
- Priority: P0
- Track: B
- Depends On: 없음
- Scope:
  - `docs/features/bidirectional-editing/README.md` 계약 섹션 확정
- DoD:
  - FE/BE가 동일 스키마로 개발 가능

---

## P1 — 핵심 편집

### BIDI-010: node.move RPC 추가
- Priority: P1
- Track: B
- Depends On: BIDI-001, BIDI-003, BIDI-004
- Scope:
  - `app/ws/methods.ts`에 `node.move` 메서드 추가
  - 공통 필드 검증 + 버전 검증 호출
- DoD:
  - 유효 요청 시 성공 + `newVersion` 반환
  - 잘못된 요청은 표준 오류코드 반환

### BIDI-011: patchNodePosition 구현
- Priority: P1
- Track: C
- Depends On: BIDI-010
- Scope:
  - `app/ws/filePatcher.ts`에 node x/y 패치 함수 구현
- DoD:
  - 대상 노드만 x/y 수정
  - 포맷 안정성 유지

### BIDI-012: Canvas drag → node.move 연결
- Priority: P1
- Track: D
- Depends On: BIDI-010, BIDI-011
- Scope:
  - `GraphCanvas.tsx`에서 `nodesDraggable` 활성화
  - `onNodeDragStop`에서 `node.move` 호출
- DoD:
  - 드래그 종료 후 파일 diff에 좌표 변경 반영

### BIDI-013: node.update 확장 (anchor/markdown/id)
- Priority: P1
- Track: B + C
- Depends On: BIDI-010
- Scope:
  - `node.update`로 `anchor/position/gap/content/id` 갱신 지원
  - id 변경 시 edge source/target 참조 갱신
- DoD:
  - UI 수정 후 코드에 반영
  - 참조 깨짐 없음

### BIDI-014: node.create 구현
- Priority: P1
- Track: B + C
- Depends On: BIDI-010
- Scope:
  - `node.create` RPC + AST 삽입
  - 타입: shape/text/markdown/mindmap
- DoD:
  - 생성 즉시 렌더 반영

### BIDI-015: node.reparent 구현
- Priority: P1
- Track: B + C
- Depends On: BIDI-010
- Scope:
  - 부모 변경 로직 + mindmap scope 반영
  - cycle 검사
- DoD:
  - 유효 reparent 저장
  - cycle은 `40902` 반환

---

## P2 — 안정화

### BIDI-020: conflict 처리 + 롤백 UX
- Priority: P2
- Track: D
- Depends On: BIDI-012, BIDI-013, BIDI-015
- Scope:
  - optimistic 적용 후 실패 시 롤백
  - `VERSION_CONFLICT` 토스트 + 재동기화
- DoD:
  - 충돌 시 데이터 유실 없음

### BIDI-021: self-origin 루프 방지
- Priority: P2
- Track: D + B
- Depends On: BIDI-012
- Scope:
  - `file.changed` 수신 시 same-origin 무시
- DoD:
  - 중복 렌더/루프 없음

### BIDI-022: 단위 테스트 세트
- Priority: P2
- Track: E
- Depends On: BIDI-011, BIDI-013, BIDI-014, BIDI-015
- Scope:
  - patcher 테스트(move/update/create/reparent/cycle)
- DoD:
  - 핵심 경로 테스트 통과

### BIDI-023: 통합 테스트 세트
- Priority: P2
- Track: E
- Depends On: BIDI-012, BIDI-020, BIDI-021
- Scope:
  - RPC→파일저장→알림→재렌더 시나리오
- DoD:
  - 주요 유저 플로우 통과

### BIDI-024: 수동 QA 체크리스트
- Priority: P2
- Track: E
- Depends On: BIDI-012~015
- Scope:
  - 자유배치/앵커/markdown/id/생성/reparent 수동 시나리오 문서화
- DoD:
  - QA 문서와 실제 결과 일치

---

## 4. 추천 실행 순서

1) `BIDI-001~004` (Contract Freeze)
2) 병렬 착수:
   - A: `BIDI-002,003`
   - B/C: `BIDI-010,011`
   - D: `BIDI-012`
3) 기능 확장: `BIDI-013,014,015`
4) 안정화: `BIDI-020~024`

---

## 5. 즉시 착수용 Sprint 1 (1주 기준)

- 포함:
  - `BIDI-001,002,003,004,010,011,012`
- 제외:
  - `node.create`, `reparent`, `id update`
- 스프린트 목표:
  - “드래그한 노드 좌표가 코드로 저장되는 것”을 end-to-end로 성공

---

## 6. 완료 정의 (Definition of Done)

- 기능별 DoD 통과
- 테스트 통과(단위/통합/수동)
- 충돌 시 데이터 유실 없음
- 문서 최신화(README + 본 계획서)
