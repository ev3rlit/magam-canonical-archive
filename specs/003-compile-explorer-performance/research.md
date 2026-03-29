# Phase 0 Research: Compile & Explorer Performance

## Decision 1: `app/page.tsx`를 thin orchestration 계층으로 분리

- Decision: `app/app/page.tsx`에서 대형 렌더/파싱/UI orchestration을 분리하고, 페이지는 최소 셸 + 핵심 진입만 유지한다.
- Rationale: 현재 `/` route compile 병목의 중심은 `'use client'` 대형 엔트리이며, 라우트 단위 무효화 범위를 줄이는 것이 가장 직접적인 개선 경로다.
- Alternatives considered:
  - 단순 함수 추출만 수행: 읽기성은 개선되지만 compile graph 크기 변화가 작다.
  - 라우트 분할(기능별 별도 페이지): 효과는 크지만 UX/상태 회귀 위험이 높다.

## Decision 2: optional UI를 `next/dynamic` 경계로 지연 로딩

- Decision: `SearchOverlay`, `QuickOpenDialog`, `StickerInspector`를 초기 route 필수 경로에서 분리해 필요한 시점에 로딩한다.
- Rationale: 현재는 닫힌 상태에서도 static import로 route compile 영향이 발생한다.
- Alternatives considered:
  - static import 유지: 구현은 단순하나 첫 컴파일 지연이 유지된다.
  - 완전 별도 라우트: 효과는 있으나 인터랙션 모델 변경 비용이 크다.

## Decision 3: `jspdf`를 export 시점 동적 import로 전환

- Decision: `app/hooks/useExportImage.ts`의 top-level `jsPDF` import를 제거하고 PDF 생성 branch에서 `await import('jspdf')`로 로딩한다.
- Rationale: PDF 기능은 선택 기능이며 핵심 편집 경로와 분리 가능하다. 고비용 라이브러리를 첫 진입 번들에서 제거할 수 있다.
- Alternatives considered:
  - static import 유지: 첫 로드와 route compile 비용이 증가한다.
  - 별도 worker 분리: 효과는 있으나 구현 범위가 크다.

## Decision 4: markdown/code 렌더러를 단계적으로 지연 로딩

- Decision: `react-syntax-highlighter`를 우선 지연 로딩하고, `react-markdown`은 `MarkdownNode` 단독이 아닌 공유 렌더 경로 전체(`renderableContent`, `StickerNode`)를 포함해 단계적으로 분리한다.
- Rationale: markdown은 다중 경로에서 사용되므로 부분적 분리만으로는 효과가 제한된다.
- Alternatives considered:
  - `MarkdownNode`만 지연 로딩: 변경은 적으나 실제 절감폭이 작다.
  - 라이브러리 교체: 잠재 효과는 있으나 회귀/표현 차이 검증 비용이 높다.

## Decision 5: dev 워밍업은 opt-in + best-effort 정책

- Decision: `cli.ts`에서 `MAGAM_WARMUP=1` 또는 `--warmup` 시, Next 기동 후 `GET /` -> `GET /api/file-tree` 순차 워밍업을 수행한다.
- Rationale: 첫 사용자 요청 지연을 서버 시작 시점으로 이동시켜 체감을 개선한다. 기본값 비활성으로 기존 워크플로를 보존한다.
- Alternatives considered:
  - 기본 always-on 워밍업: 편리하지만 시작 CPU 피크/실패 노이즈가 증가한다.
  - 백엔드 `/file-tree`만 워밍업: Next route compile 지연을 해결하지 못한다.

## Decision 6: 워밍업 실패 정책은 strict/non-strict 이중화

- Decision: 기본은 실패 경고 후 계속 진행하고, `MAGAM_WARMUP_STRICT=1`에서만 실패 시 프로세스를 종료한다.
- Rationale: 개발 편의성과 CI/재현성 요구를 동시에 충족한다.
- Alternatives considered:
  - 항상 실패 종료: 일시 오류에도 dev 진입이 차단된다.
  - 항상 무시: CI나 자동 검증에서 신뢰 가능한 신호를 얻기 어렵다.

## Decision 7: 성능 계측 계약을 문서화하고 단계별 검증 루프를 고정

- Decision: 빌드/route/API 지연을 동일 포맷으로 기록하는 계약 문서를 두고, 개선 전후를 동일 지표로 비교한다.
- Rationale: 개선 작업이 체감 기반 추정으로 흘러가는 것을 방지하고 회귀 감지를 자동화할 수 있다.
- Alternatives considered:
  - ad-hoc 수동 측정: 반복 가능성이 낮고 비교 신뢰도가 떨어진다.
  - 단일 총시간만 기록: 병목 단계 식별이 불가능하다.

## Clarification Resolution Status

- Technical Context의 `NEEDS CLARIFICATION` 항목 없음.
- 개선 우선순위 및 적용 범위(클라이언트 경계 축소 -> 동적 로딩 -> 워밍업)는 확정됨.

## Post-Implementation Notes (2026-03-02)

- Decision 1/2/3/4/5/6/7 모두 코드에 반영됨.
- 반복 편집 루프(`after-change /`) 지표는 개선 신호가 확인됨.
- `first-load /`, `first-load /api/file-tree`, `next-proxy /file-tree warm`은 추가 최적화가 필요함.
- correctness 검증(`verify-render-consistency`, `verify-filetree-consistency`)은 통과함.
