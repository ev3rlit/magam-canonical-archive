# Quickstart: Object Capability Composition

## 목적

`007-object-capability-composition` 기능의 구현/검증 기준을 빠르게 재실행하기 위한 최소 실행 절차.

## 작업 문서 링크

- 스펙: `specs/007-object-capability-composition/spec.md`
- 플랜: `specs/007-object-capability-composition/plan.md`
- 리서치: `specs/007-object-capability-composition/research.md`
- 데이터 모델: `specs/007-object-capability-composition/data-model.md`
- 계약:
  - `specs/007-object-capability-composition/contracts/canonical-object-core-contract.md`
  - `specs/007-object-capability-composition/contracts/capability-declaration-contract.md`
  - `specs/007-object-capability-composition/contracts/alias-normalization-contract.md`
  - `specs/007-object-capability-composition/contracts/content-kind-boundary-contract.md`
  - `specs/007-object-capability-composition/contracts/renderer-routing-contract.md`
  - `specs/007-object-capability-composition/contracts/patch-editability-contract.md`
  - `specs/007-object-capability-composition/contracts/migration-compatibility-contract.md`

## 1) 준비

```bash
cd /Users/danghamo/Documents/gituhb/magam-object-capability-model-docs
bun install
```

## 2) 구현 순서

1. canonical schema, minimal semantic role enum, capability registry 초안 추가
   - `app/features/render/` 또는 `app/features/editing/` 하위 신규 모듈
2. alias + legacy props -> canonical normalization 경로 추가
   - `app/features/render/parseRenderGraph.ts`
3. precedence rule 적용
   - explicit capability > legacy inference > alias preset default
4. capability 기반 editability/profile 계산으로 전환
   - `app/features/editing/editability.ts`
   - `app/features/editing/commands.ts`
   - `app/features/editing/createDefaults.ts`
5. WS patch surface를 capability/content contract gate 중심으로 정리
   - `app/ws/filePatcher.ts`
   - `app/ws/methods.ts`
6. 공개 alias 호환성과 legacy inference 회귀 검증
   - `libs/core/src/components/{Node,Shape,Sticky,Image,Markdown,Sequence,Sticker}.tsx` 관련 테스트

## 3) 구현 체크포인트

- Checkpoint A: legacy alias 입력이 upfront migration 없이 canonical object 구조로 정규화된다. 완료
- Checkpoint B: canonical semantic role은 최소 안정 집합으로 유지된다. 완료
- Checkpoint C: explicit user capability가 alias preset default보다 우선한다. 완료
- Checkpoint D: `Sticky`는 일부 기본 capability 제거 후에도 `sticky-note` semantic을 유지한다. 완료
- Checkpoint E: `Image`/`Markdown`/`Sequence`는 content contract 검증을 유지하고 content-kind mismatch는 명시적으로 거부된다. 완료
- Checkpoint F: renderer/editability 판단이 canonical capability/profile 우선으로 동작한다. 완료
- Checkpoint G: 기존 alias 문서가 저장/재렌더 시 깨지지 않는다. 회귀 테스트 완료

## 4) 테스트

```bash
# parser + normalization + node capability regressions
bun test \
  app/features/render/parseRenderGraph.test.ts \
  app/components/nodes/ShapeNode.test.tsx \
  app/components/nodes/StickyNode.test.tsx \
  app/components/nodes/renderableContent.test.tsx \
  app/components/nodes/MarkdownNode.test.tsx

# patch/method contracts
bun test app/ws/filePatcher.test.ts app/ws/methods.test.ts

# UI edit routing regression
bun test app/components/editor/WorkspaceClient.test.tsx app/components/GraphCanvas.test.tsx

# core alias component regression
bun test libs/core/src/__tests__/object-capability-aliases.spec.tsx

# lightweight import smoke for capability/editability runtime modules
bun -e "await import('./app/features/editing/editability.ts'); await import('./app/features/editing/capabilityProfile.ts'); await import('./app/components/editor/workspaceEditUtils.ts'); await import('./app/components/GraphCanvas.drag.ts'); await import('./app/ws/filePatcher.ts'); console.log('object-capability-smoke-ok')"
```

## 5) 수동 검증 시나리오

1. `Node`, `Shape`, `Sticky`, `Image`, `Markdown`, `Sequence` 예제를 렌더하고 기존 시각 결과를 비교한다.
2. explicit capability override가 alias preset default보다 우선하는지 확인한다.
3. legacy 문서를 열었을 때 별도 migration 없이 capability inference가 적용되는지 확인한다.
4. `Sticky`에서 일부 기본 capability를 제거해도 sticky semantic이 유지되는지 확인한다.
5. Image/Markdown/Sequence 편집에서 content-kind mismatch 입력이 명시적으로 거부되는지 확인한다.
6. 동일 capability 조합을 가진 alias 간 편집 허용 결과가 일치하는지 확인한다.

## 6) 정량 검증 기준

- SC-001: alias 기반 회귀 시나리오 95%+ 기능 동등성
- SC-002: Sticky capability 재사용 시나리오 95%+ 성공
- SC-003: content boundary 회귀 99%+ 유지
- SC-004: tag-name 하드코딩 분기 50%+ 축소
- SC-005: capability-only 확장 사례 최소 1건 실증
- SC-006: public API 호환 시나리오 99%+ 유지

## 7) 실행 노트

- 현재 워크트리에서는 Phase 1~6 구현과 주요 회귀가 반영된 상태다.
- 저장 포맷 일괄 마이그레이션은 여전히 후속 단계다.
- `Markdown`, `Sticker`, `Sequence`의 장기 분류 정책은 구현 블로커가 아니므로 analyze 또는 ADR에서 별도로 다룬다.
