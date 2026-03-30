# Bidirectional Editing PRD (Revised v1)

## 1) 목표

Magam의 현재 강점(코드 → 캔버스 렌더링)을 유지하면서,
**캔버스 편집 → 코드 반영**을 안전하게 추가한다.

핵심 원칙:
- TSX 파일이 단일 소스 오브 트루스
- 캔버스 상태는 코드에서 파생
- 편집 반영은 문자열 치환이 아니라 AST 패치
- 충돌 시 저장보다 안전(거부 + 재동기화) 우선

---

## 2) 이번 재설계의 범위

## v1 (먼저 구현)
- Canvas 노드 이동 (`node.move`)
- 자유 배치(absolute positioning) 지원
- 앵커(Anchor) 노드 이동 지원
- 노드 id 편집
- 마크다운 노드 내용 편집
- 노드 생성(기본 Shape/Text/Markdown)
- 도형 생성(Shape 타입 생성)
- 부모 변경(reparent) 기능 (MindMap 포함)

## v2 (후속)
- MindMap reorder(형제 순서 정렬)
- 고급 마크다운 편집 UX(툴바/슬래시 명령)
- 다중 선택 일괄 편집
- 협업 동시 편집(CRDT/OT)

---

## 3) 기능 요구사항 (요청 반영)

1. **앵커 기능**
   - 앵커 기반 노드(`anchor`, `position`, `gap`)를 캔버스에서 이동/수정 가능
   - 코드 저장 시 해당 props 정확히 반영

2. **자유 배치 기능**
   - 일반 노드는 x/y 자유 이동
   - 드래그 종료 시 코드 x/y 반영

3. **마크다운 편집**
   - Markdown 노드 content 편집 가능
   - 저장 시 JSX/prop 일관성 유지

4. **노드 id 편집**
   - id 수정 가능
   - id 변경 시 edge source/target 참조 업데이트 필요

5. **생성 기능**
   - MindMap 생성
   - 노드 생성
   - 도형(Shape) 생성

6. **부모 변경(reparent)**
   - 노드의 부모 변경 지원
   - MindMap에서는 `from` / 그룹 컨텍스트 기준으로 반영
   - cycle 검사 필수

---

## 4) 데이터/동기화 모델 (단순 + 안전)

## 4.1 렌더 응답 메타
`/render` 응답에 아래 메타 추가:
- `sourceVersion`: 파일 해시
- 노드별 `sourceMeta`:
  - `sourceId`
  - `kind` (`canvas | mindmap`)
  - `scopeId` (mindmap id 등)

## 4.2 클라이언트 상태
`GraphState` 확장:
- `sourceVersion: string | null`
- `clientId: string`
- `lastAppliedCommandId?: string`

## 4.3 RPC 공통 필드
모든 편집 요청 공통:
- `filePath`
- `baseVersion`
- `originId`
- `commandId`

---

## 5) RPC 명세 (v1)

## 5.1 node.move
노드 좌표 이동 반영

```json
{
  "method": "node.move",
  "params": {
    "filePath": "examples/mindmap.tsx",
    "nodeId": "client",
    "x": 320,
    "y": 180,
    "baseVersion": "sha256:...",
    "originId": "client-uuid",
    "commandId": "cmd-uuid"
  }
}
```

## 5.2 node.update
마크다운/anchor/id 등 속성 편집
- `props` 기반 부분 수정

## 5.3 node.create
새 노드 생성
- 타입: `shape | text | markdown | mindmap`
- 초기 props 포함

## 5.4 node.reparent
부모 변경
- `nodeId`, `newParentId`
- mindmap일 경우 `from`/scope 규칙 적용
- cycle 검사

## 5.5 file.changed notification

```json
{
  "method": "file.changed",
  "params": {
    "filePath": "examples/mindmap.tsx",
    "version": "sha256:new",
    "originId": "client-uuid",
    "commandId": "cmd-uuid",
    "timestamp": 1739439000000
  }
}
```

클라이언트 규칙:
- 동일 `originId`면 자기 이벤트로 간주하고 루프 방지
- 다르면 재렌더링

---

## 6) 오류 코드

- `40001 INVALID_PARAMS`
- `40401 NODE_NOT_FOUND`
- `40901 VERSION_CONFLICT`
- `40902 MINDMAP_CYCLE`
- `50001 PATCH_FAILED`

---

## 7) UX 규칙

1. 드래그/수정은 optimistic 반영
2. 실패 시 롤백 + 원인 토스트
3. 충돌 시 “외부 수정 감지, 최신 상태 재동기화” 안내
4. 편집 중 저장 지연 시 진행 상태 표시
5. id 변경 영향(edge 참조 변경 예정)을 미리 안내

---

## 8) 구현 단계 (재정의)

## Phase A (기반)
- `/render`에 `sourceVersion` 추가
- 노드 `sourceMeta` 주입
- store에 `sourceVersion/clientId` 추가

## Phase B (핵심 편집)
- `node.move`
- `node.update` (anchor, markdown, id 일부)
- `node.create`

## Phase C (구조 편집)
- `node.reparent`
- cycle 검사
- mindmap scope 반영

## Phase D (안정화)
- conflict 처리
- self-origin loop 방지
- 테스트 확장

---

## 9) 테스트 전략

- 단위: patcher(`move/update/create/reparent`)
- 통합: RPC 요청 → 파일 저장 → file.changed 알림
- 수동:
  - 자유 배치 후 코드 반영 확인
  - anchor 이동 후 코드 반영 확인
  - markdown 수정 반영 확인
  - id 변경 + edge 참조 정합성 확인
  - reparent + cycle 차단 확인

---

## 10) 수용 기준

1. 캔버스 이동/수정이 코드에 반영된다.
2. markdown/id/anchor 편집이 저장된다.
3. 노드/도형/마인드맵 생성이 동작한다.
4. 부모 변경이 동작하고 cycle은 차단된다.
5. 충돌/실패 시 데이터 유실 없이 복구된다.

---

## 11) 오픈 이슈

- id 변경 시 참조 업데이트 범위(Edge 외 추가 참조) 확정 필요
- mindmap reparent 시 자동 레이아웃 재실행 타이밍
- markdown 편집 UX(인라인 vs 사이드 패널) 결정
