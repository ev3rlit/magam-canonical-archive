# Migration Plan

## 원칙

- 앱 UI 문자열은 `app/features/i18n/locales/*`에서 중앙 관리합니다.
- 기능별 `copy.ts`는 locale dictionary를 읽는 adapter로만 사용합니다.
- 기본 생성 텍스트는 `app/features/editing/defaultContent.ts`로 분리합니다.
- API/CLI human-readable 메시지는 별도 `messages.ts`로 분리합니다.
- machine-readable code는 번역하지 않습니다.
- CLI는 영어 고정 정책을 유지합니다.

## 적용 순서

1. 중앙 locale dictionary 도입
2. UI adapter 도입
3. 앱 UI/워크스페이스 UI 이동
4. 캔버스 authoring label 이동
5. default content 이동
6. API/CLI 메시지 분리

## 네이밍 규칙

- locale namespace는 기능 기준으로 자릅니다.
  - `ui.*`
  - `workspace.*`
  - `canvas.*`
  - `defaultContent.*`
- adapter는 번역 키를 재정의하지 않고 읽기 편한 진입점만 제공합니다.
- locale value가 사용자에게 보이는 텍스트라도 ID seed로 재사용하지 않습니다.

## CLI 정책

- CLI help/status/error는 영어 유지
- CLI에는 locale switching을 도입하지 않음
- 필요한 경우에도 `libs/cli/src/messages.ts`에서 영어 메시지만 관리
