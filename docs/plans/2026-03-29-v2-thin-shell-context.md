# V2 Thin Shell Context

## 목적

이 문서는 다음 세션에서 바로 이어서 작업할 수 있도록, 현재 코드베이스에 대한 판단과 V2 재시작 방향을 컨텍스트 프롬프트 형태로 고정한다.

핵심 판단은 아래와 같다.

- 전면 재작성은 아직 아니다.
- 현재의 거대한 앱 레이어는 더 이상 계속 수선하지 않는다.
- `canonical model + persistence/runtime + desktop bridge` 같은 코어 자산은 유지한다.
- 그 위에 사용자 가치가 바로 보이는 `얇은 V2 앱 셸`을 새로 만든다.

## 현재 진단

- 코드량과 하위 시스템은 크지만, 사용자 관점의 완료된 세로 흐름이 없다.
- `GraphCanvas.tsx`, `CanvasEditorPage.tsx`, 그래프 스토어와 각종 entrypoint/orchestration 레이어가 과도하게 결합되어 있다.
- 지난 일주일 동안 내부 구조를 계속 손봤지만, 실제 사용 가능한 핵심 플로우가 하나도 나오지 못했다.
- 따라서 지금의 우선순위는 기능 추가가 아니라 `최소 동작 경로를 끝까지 완성하는 것`이다.

## 유지할 것

- canonical data model
- database-first persistence/runtime
- desktop host bridge / runtime service
- 최소한의 canvas mutation/query path
- workspace/app-state persistence 중 이미 안정적인 부분

## 버릴 것 또는 당장 의존하지 않을 것

- 현재의 대형 editor shell
- 과도하게 결합된 global graph store 중심 조합
- 한 번에 많은 editing surface를 다 품으려는 구조
- toolbar / floating menu / pane menu / node menu를 동시에 살리려는 접근
- 기존 UI를 보존해야 한다는 전제

## V2에서 가장 먼저 통과해야 하는 흐름

아래 6단계가 V2의 첫 완료 조건이다.

1. 앱 실행
2. 워크스페이스 열기
3. 캔버스 1개 만들기
4. 텍스트 또는 스티키 1개 추가
5. 저장
6. 재실행 후 그대로 복원

이 6단계가 되기 전까지 나머지 기능은 모두 부가 기능으로 취급한다.

## 다음 세션용 작업 프롬프트

아래를 새 세션의 시작 프롬프트로 사용한다.

> 우리는 Magam의 V2를 `thin app shell on top of existing core` 방식으로 다시 시작한다.
> 목표는 기존 거대한 editor shell을 계속 수선하는 것이 아니라, 기존 코어 자산을 재사용해 사용자 가치가 보이는 최소 흐름 1개를 끝까지 완성하는 것이다.
>
> 필수 제약:
> - `canonical model`, `database-first persistence/runtime`, `desktop bridge`는 최대한 재사용한다.
> - 기존 `GraphCanvas.tsx`, `CanvasEditorPage.tsx`, 대형 graph store에 직접 의존하는 범위를 최소화한다.
> - 새 앱 셸은 작고 명시적인 상태 경계를 가져야 한다.
> - 기존 UI 호환성보다 세로 슬라이스 완성이 우선이다.
>
> 첫 번째 완료 기준:
> 1. 앱 실행
> 2. 워크스페이스 열기
> 3. 캔버스 1개 만들기
> 4. 텍스트 또는 스티키 1개 추가
> 5. 저장
> 6. 재실행 후 복원
>
> 작업 원칙:
> - 기존 앱 레이어를 계속 구조조정하지 말고, 필요한 코어만 끌어와 얇은 V2 경로를 만든다.
> - 새 레이어의 ownership을 분명히 한다.
> - 상태는 화면 셸, workspace/session, canvas document, create action 정도로 최소 분리한다.
> - 첫 세로 슬라이스에 필요 없는 menu, overlay, plugin, advanced editing, broad compatibility는 보류한다.
> - "나중에 필요할 수도 있음"을 이유로 추상화하지 않는다.
>
> 우선 해야 할 일:
> 1. V2 엔트리 경로와 파일 소유 경계를 제안한다.
> 2. 재사용할 코어 API를 확정한다.
> 3. 첫 세로 슬라이스를 구현한다.
> 4. 실제 실행/저장/복원까지 검증한다.

## 제안하는 V2 구조

아래는 권장안이며, 더 단순해질 수 있으면 더 단순하게 가도 된다.

- `app/features/v2-shell/`
- `app/features/v2-shell/app/`
- `app/features/v2-shell/workspace/`
- `app/features/v2-shell/canvas/`
- `app/features/v2-shell/state/`

가능하면 아래 책임만 먼저 둔다.

- `AppShellV2`: 앱 시작과 라우팅
- `WorkspacePickerV2`: 워크스페이스 선택/복원
- `CanvasHomeV2`: 최근 canvas 또는 새 canvas 진입
- `CanvasSurfaceV2`: 최소 캔버스 표시와 create action
- `CanvasPersistenceV2`: 저장/복원 연계

## 명시적 비목표

첫 V2 슬라이스에서 아래는 하지 않는다.

- 다중 editing entrypoint 복원
- 범용 node menu/floating menu 복원
- plugin runtime 연결
- broad alias compatibility polishing
- advanced layout/selection UX
- 대규모 기존 컴포넌트 정리 작업

## 참고 파일

재사용 후보를 판단할 때 우선 볼 파일:

- `libs/shared/src/lib/canonical-persistence/`
- `app/features/desktop-host/runtimeService.ts`
- `app/features/host/rpc/desktopAdapter.ts`
- `app/hooks/useCanvasRuntime.ts`
- `docs/features/database-first-canvas-platform/README.md`
- `docs/features/database-first-canvas-platform/schema-modeling.md`

당장 V2의 기반으로 삼지 말아야 할 파일:

- `app/components/GraphCanvas.tsx`
- `app/features/editor/pages/CanvasEditorPage.tsx`
- 기존 대형 graph store 결합 레이어 전반

## 완료 정의

다음 세션의 1차 종료 조건:

- V2 경로로 앱을 실제 실행할 수 있다.
- 워크스페이스를 고를 수 있다.
- 새 캔버스를 만들 수 있다.
- 텍스트 또는 스티키 하나를 생성할 수 있다.
- 앱을 껐다 켜도 같은 상태가 복원된다.
- 이 경로가 기존 대형 editor shell에 의존하지 않거나 의존성이 매우 얇다.
