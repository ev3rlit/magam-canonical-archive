# App/CLI Runtime Models

## 개요

이 report는 데스크톱 UI 앱과 CLI 앱이 같은 canonical canvas/data를 다루는 두 가지 로컬 실행 모델을 비교하기 위해 작성했다.

비교 대상은 다음 두 모델이다.

- app-attached arbiter 모델
- direct file/database write 모델

이 문서들의 목적은 구현 지시가 아니라 선택지 비교와 trade-off 정리다.

## 포함 문서

- `./app-attached-cli-arbiter.md`
  - 현재 실행 중인 앱과 외부 CLI를 local IPC / JSON-RPC 조정자로 연결하는 모델
- `./direct-file-write-model.md`
  - UI와 CLI가 직접 통신하지 않고 shared file / DB를 통해 간접 동기화하는 모델

## 현재 판단

이 report를 작성한 뒤의 현재 방향은 다음과 같다.

- UI 앱과 CLI 앱의 direct transport는 두지 않는다.
- 실시간 attach/session 공유보다 shared DB 기반 coordination을 우선한다.
- 다음 feature는 `UI 앱 <-> 런타임 <-> DB <-> 런타임 <-> CLI 앱` 모델을 구체화하는 쪽으로 진행한다.

즉 이 report는 최종 설계 문서가 아니라, 새 feature 문서의 배경 자료로 남긴다.
