# String Classification

## 목적

하드코딩 문자열 개선 작업에서 문자열 종류를 구분해 오탐과 과도한 i18n 적용을 막습니다.

## 분류

### 1. UI locale data

- 사용자 화면에 직접 노출되는 텍스트
- 위치: `app/features/i18n/locales/ko.ts`, `app/features/i18n/locales/en.ts`
- 예시: 버튼 라벨, placeholder, empty state, 메뉴 라벨, 다이얼로그 제목

### 2. Feature adapters

- 중앙 locale 데이터를 기능별/컴포넌트별로 읽기 쉽게 묶는 얇은 계층
- 위치:
  - `app/components/ui/copy.ts`
  - `app/features/workspace/copy.ts`
  - `app/features/canvas-ui-entrypoints/copy.ts`

### 3. Default content

- 사용자에게 보이는 초기 콘텐츠이지만 UI 라벨과는 성격이 다른 기본 생성값
- 위치: `app/features/editing/defaultContent.ts`
- 주의: ID seed는 locale 텍스트와 분리해 ASCII 안정성을 유지합니다.

### 4. Internal messages

- API/CLI/WS/MCP의 사람이 읽는 메시지
- 위치:
  - `app/app/api/_shared/messages.ts`
  - `libs/cli/src/messages.ts`
- 주의: machine-readable code는 그대로 유지하고 설명 텍스트만 분리합니다.

### 5. Machine-readable codes

- 프로토콜, RPC, patch, validation code
- 예시: `EDIT_NOT_ALLOWED`, `WS_400_INVALID_ACTION`
- 정책: 번역하지 않고 stable identifier로 유지합니다.
