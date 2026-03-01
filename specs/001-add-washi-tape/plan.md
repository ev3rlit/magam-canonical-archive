# Implementation Plan: Washi Tape Object

**Branch**: `001-add-washi-tape` | **Date**: 2026-03-01 | **Spec**: `/Users/danghamo/Documents/gituhb/magam-washi-tape/specs/001-add-washi-tape/spec.md`
**Input**: Feature specification from `/specs/001-add-washi-tape/spec.md` and `docs/features/washi-tape/README.md`

## Summary

`sticker`와 공존하는 신규 오브젝트 타입 `washi-tape`를 도입한다. 핵심 접근은 코어 렌더러의 host 노드(`graph-washi-tape`) 추가, 앱 파서의 노드 매핑(`washi-tape`) 확장, 스타일/배치 정규화 유틸 분리, WebSocket RPC 타입 계약 확장, export 경로 회귀 테스트 강화다. v1에서는 직접 변형 편집과 전용 Inspector 없이 삽입/선택/스타일 전환/내보내기 일관성에 집중하며, 사전 제공 `PresetPattern` 카탈로그를 ID 기반으로 노출/복원한다.

## Technical Context

**Language/Version**: TypeScript 5.9.x, React 18, Bun 1.x workspace runtime  
**Primary Dependencies**: React Flow 11, Next.js app runtime, `@babel/*` AST patcher, Tailwind CSS, `zod` (필요 시 런타임 검증)  
**Storage**: 파일 기반 TSX 그래프 소스 + 메모리 상태(zustand), 신규 DB 저장소 없음  
**Testing**: `bun test` 단위/통합, `libs/core` renderer 테스트, `playwright` E2E, PDF/이미지 골든 회귀 테스트  
**Target Platform**: 데스크톱 브라우저 기반 웹 앱 + 로컬 Bun HTTP/WS 서버  
**Project Type**: 모노레포(웹 앱 + 렌더러 라이브러리 + CLI/서버)  
**Performance Goals**: 장면당 와시 테이프 100개 규모에서 삽입/선택/포커스 동작 체감 지연 최소화, save/reopen 보존율 100% 달성  
**Constraints**: v1 범위에서 전용 Inspector/직접 변형 핸들 미제공, `sticker` 회귀 금지, invalid 패턴 입력 시 안전 fallback 필수  
**Scale/Scope**: 코어 host + 앱 파서/렌더 + WS 편집 경로 + export 경로 + 회귀 테스트를 포함한 엔드투엔드 통합 범위

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- 헌장 파일(`/Users/danghamo/Documents/gituhb/magam-washi-tape/.specify/memory/constitution.md`)이 placeholder 템플릿 상태이며 강제 가능한 조항이 정의되지 않음.
- Pre-Phase-0 Gate 결과: **PASS (Provisional)**  
  - 사유: 위반 가능한 구체 조항이 없으므로, 스펙의 범위/품질 기준을 임시 게이트로 사용.
- 임시 게이트:
  - `sticker` 동작 회귀 금지(동일 문서 공존 보장)
  - 내보내기 결과 일관성 유지(PNG/JPEG/SVG/PDF)
  - invalid 커스텀 패턴 입력 시 크래시 없이 fallback
  - v1 비목표(Inspector/직접 편집) 준수
- Post-Phase-1 재검토 결과: **PASS** (아래 data model/contracts/quickstart가 임시 게이트를 충족하도록 설계됨)

## Project Structure

### Documentation (this feature)

```text
specs/001-add-washi-tape/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── washi-tape-host-node-contract.md
│   └── washi-tape-rpc-contract.md
└── tasks.md              # /speckit.tasks 단계에서 생성
```

### Source Code (repository root)

```text
app/
├── app/page.tsx
├── components/GraphCanvas.tsx
├── components/nodes/
│   ├── StickerNode.tsx
│   └── WashiTapeNode.tsx          # 신규
├── app/globals.css
├── store/graph.ts
├── utils/
│   ├── childComposition.ts
│   ├── nodeContent.ts
│   ├── stickerJitter.ts
│   ├── washiTapeDefaults.ts       # 신규
│   ├── washiTapeGeometry.ts       # 신규
│   └── washiTapePattern.ts        # 신규
└── ws/
    ├── methods.ts
    ├── methods.test.ts
    ├── filePatcher.ts
    └── filePatcher.test.ts

libs/
├── core/src/components/
│   ├── Sticker.tsx
│   └── WashiTape.tsx              # 신규
├── core/src/__tests__/
│   └── washi-tape.spec.tsx        # 신규
└── cli/src/server/http.ts

e2e/
docs/features/washi-tape/README.md
```

**Structure Decision**: 기존 모노레포 구조를 유지하고 `libs/core -> app parser -> app UI node -> ws patch path -> export`의 단일 파이프라인을 확장한다. 별도 서비스나 저장소 분리는 필요하지 않으며, `sticker` 구현 경로를 레퍼런스로 동일 계층에 신규 타입을 추가한다.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| 없음 | N/A | N/A |
