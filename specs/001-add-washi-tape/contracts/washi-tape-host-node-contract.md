# Contract: Washi Tape Host Node

## 목적

코어 렌더러(`libs/core`)가 생성하는 host 노드와 앱 파서(`app/app/page.tsx`) 간의 타입/필드 계약을 명시한다.

## Contract Surface

- Producer: `WashiTape` 컴포넌트 (`libs/core/src/components/WashiTape.tsx`, 신규)
- Transport: render graph AST (`graph-*` tree)
- Consumer: 앱 파서(`app/app/page.tsx`) -> React Flow 노드 매핑

## Host Node Type

- **Required**: `type === 'graph-washi-tape'`
- **Backward compatibility**:
  - 기존 `graph-sticker` 경로와 충돌하면 안 된다.
  - `graph-washi-tape` 미지원 구버전 문서는 렌더 단계에서 무시 또는 안전 fallback 처리한다.

## Host Props Contract

| Prop | Required | Type | Notes |
|------|----------|------|-------|
| `id` | Yes | string | 고유 식별자 |
| `at` | Yes | object | `segment/polar/attach` 유니온 입력 |
| `pattern` | No | object | preset/custom 패턴 정의 |
| `preset` | No | string | `pattern` 미지정 시 sugar로 해석 |
| `edge` | No | object | 엣지 스타일 |
| `texture` | No | object | 텍스처 스타일 |
| `text` | No | object | 텍스트 스타일 |
| `seed` | No | string \| number | 결정적 지터 계산 |
| `opacity` | No | number | 0..1 |
| `className` | No | string | 클래스 확장 |

## Children Contract

- `children`는 콘텐츠 전용이며 시각 설정용 함수형 children은 금지한다.
- 파서 단계에서 `RenderableChild[]`로 정규화되어야 한다.

## Parser Mapping Contract

1. `graph-washi-tape` 수신 시 React Flow node 생성:
   - `node.type = 'washi-tape'`
   - `node.data.at` 원본 입력 보존
   - `node.data.resolvedGeometry` 계산 결과 저장
2. invalid pattern/placement 입력은 예외를 던지지 않고 fallback으로 렌더한다.
3. `sourceMeta`가 없으면 parser에서 기본값을 주입한다.

## Export Contract

- PNG/JPEG/SVG/PDF 경로에서 `graph-washi-tape` props가 손실 없이 전달되어야 한다.
- 동일 입력에 대해 캔버스와 내보내기 결과의 시각적 동등성이 유지되어야 한다.

## Validation Rules

- `at` 누락 시 노드 생성 실패(개발 단계 오류) 또는 안전 no-op 처리(런타임 보호) 중 하나를 명확히 선택하고 테스트로 고정.
- `pattern.svg.markup`은 allowlist sanitize 이후만 렌더.
- `attach.target` 미존재 시 fallback geometry를 생성하고 사용자 세션을 중단하지 않는다.
