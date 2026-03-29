# Harness Engineering For Magam

작성일: 2026-03-28  
목적: OpenAI와 Anthropic의 하네스 글을 바탕으로, 이 저장소에서 실제 작업을 어떻게 진행해야 하는지 운영 관점으로 정리한다.

## 참고한 글

- OpenAI, [하네스 엔지니어링: 에이전트 우선 세계에서 Codex 활용하기](https://openai.com/ko-KR/index/harness-engineering/)
- Anthropic, [Harness design for long-running application development](https://www.anthropic.com/engineering/harness-design-long-running-apps)

아래 내용은 두 글의 공통 원칙을 이 저장소 구조에 맞게 **재구성한 적용안** 이다.  
즉 원문 요약이 아니라, `magam` 에서 실제로 어떻게 운영하면 좋은지에 대한 권장 운영 문서다.

## 한 줄 결론

이 프로젝트의 하네스는 "에이전트가 코드를 조금 더 잘 고치게 만드는 래퍼"가 아니라, **AI 에이전트가 CLI, desktop host, web adapter, runtime access 구조를 안전하게 다루게 만드는 실행 시스템** 이어야 한다.

핵심은 세 가지다.

1. 하네스는 task 분류와 실행 모드를 먼저 고른다.
2. 하네스는 필요한 프로세스만 최소로 띄운다.
3. 하네스는 실행 결과를 로그, 검증, 산출물로 남긴다.

## 1. 두 글에서 가져와야 할 핵심 원칙

## 1.1 하네스는 스크립트 모음이 아니라 작업 시스템이다

두 글 모두 공통적으로 말하는 것은, 에이전트 성능은 모델 자체보다 **주변 실행 시스템** 에 크게 좌우된다는 점이다.

이 프로젝트에서도 중요한 것은 다음이다.

- 어떤 컨텍스트를 읽히는가
- 어떤 명령으로 앱을 띄우는가
- 어떤 로그와 검증을 남기는가
- 실패 시 어디서 다시 시작하는가

즉 하네스는 `프롬프트 + 셸 명령` 이 아니라, **작업 단위의 입구와 종료 기준을 고정하는 운영 레이어** 여야 한다.

## 1.2 단순한 해법부터 시작하고 필요할 때만 복잡도를 올린다

Anthropic 글의 핵심 중 하나는 "처음부터 과도한 하네스를 만들지 말라"는 점이다.  
이 저장소에도 그대로 적용해야 한다.

좋은 순서:

- 먼저 task 분류
- 그다음 최소 실행 모드 선택
- 그다음 필요한 health check / 검증 추가
- 마지막에만 더 긴 루프, 자동 복구, 다중 에이전트 분기를 붙임

나쁜 순서:

- 모든 task 에 대해 desktop + web + WS + HTTP + CLI를 다 띄움
- 모든 task 를 UI 자동화로만 검증
- 모든 task 에 evaluator / planner / recorder 를 붙임

## 1.3 리포지터리는 에이전트가 읽기 쉬운 운영 표면을 가져야 한다

OpenAI 글의 핵심 중 하나는, 에이전트가 잘 일하려면 리포지터리 자체가 **작업 가능한 형태** 여야 한다는 점이다.

이 저장소에서는 이미 좋은 출발점이 있다.

- `docs/features/*`
- `docs/reports/*`
- `docs/guide/dev-startup-flow.md`
- `docs/features/m2/runtime-access-refactoring/README.md`

하네스는 이 문서들을 더 잘 활용하게 해야지, 별도의 숨겨진 절차를 만들면 안 된다.

## 1.4 long-running app 은 프로세스/상태/복구를 분리해서 다뤄야 한다

Anthropic 글에서 우리 프로젝트에 특히 중요한 부분은 long-running app 관점이다.

`magam` 은 단순 라이브러리 테스트 프로젝트가 아니다.

- Next.js app
- HTTP render server
- WS sync server
- Electron desktop host
- CLI / headless runtime

이런 프로젝트는 "앱 실행" 자체가 검증의 일부다.  
따라서 하네스는 코드 편집 도구가 아니라 **프로세스 orchestration 도구** 여야 한다.

## 2. 우리 프로젝트에서 하네스가 꼭 알아야 하는 사실

## 2.1 현재 실행 구조는 멀티 프로세스다

`docs/guide/dev-startup-flow.md` 기준으로, 기본 개발 실행은 단일 서버가 아니라 여러 프로세스 조합이다.

- Next.js app
- HTTP render server
- WS server

그리고 desktop 쪽은 별도로 host/main process 가 이 백엔드들을 띄운다.

즉 하네스는 처음부터 아래 질문에 답할 수 있어야 한다.

- 이번 task 에 진짜 필요한 프로세스는 무엇인가?
- `bun dev` 전체가 필요한가?
- CLI만으로 충분한가?
- desktop host 까지 실제로 띄워야 하는가?

## 2.2 상위 아키텍처 방향은 이미 정해져 있다

`docs/features/m2/runtime-access-refactoring/README.md` 기준으로, 이 저장소의 상위 방향은 아래다.

- `shared runtime + canonical DB + collaboration event log` 가 코어
- AI 에이전트의 공식 진입점은 `CLI`
- desktop runtime owner 는 `host/main process`
- `HTTP/WS` 는 thin adapter

즉 하네스도 이 방향을 강화해야 한다.

좋은 하네스:

- CLI task 는 CLI로 검증
- desktop task 는 host 기준으로 검증
- web task 는 adapter 기준으로 검증

나쁜 하네스:

- 모든 task 를 브라우저로만 검증
- 에이전트가 DB를 직접 수정
- renderer 를 runtime owner처럼 다룸

## 2.3 지금 가장 민감한 과도기 영역은 compatibility 다

현재 프로젝트는 `runtime access` 재정렬과 `compatibility hard removal` 이 동시에 진행 중이다.

따라서 하네스는 아래 구분을 알고 있어야 한다.

- runtime-only 경로를 검증하는 task
- 아직 compatibility 경로가 남아 있는 task

이 구분이 없으면 에이전트는 오래된 file-first 흐름과 새 runtime-only 방향을 섞어서 작업하게 된다.

## 3. 우리 프로젝트용 권장 하네스 구조

권장 구조는 아래 5층이다.

## 3.1 Task Brief Layer

작업 시작 전에 하네스는 최소한 아래를 고정해야 한다.

- 목표
- 수정 범위
- 실행 모드
- 검증 기준
- 금지 경로

이 저장소에서는 특히 아래 금지 경로를 자주 명시해야 한다.

- direct DB patch
- renderer-owned runtime
- compatibility path 재확산
- 불필요한 full-stack boot

## 3.2 Workspace Layer

하네스는 현재 workspace 상태를 먼저 파악해야 한다.

- git 변경사항 확인
- 대상 문서/코드 위치 확인
- 관련 feature 문서 확인

이 레이어의 역할은 "정답 생성"이 아니라 **현재 상태 오판 방지** 다.

## 3.3 Mode Selector Layer

하네스는 task 를 4개 모드 중 하나로 분류해 실행해야 한다.

### Mode A. Docs / Architecture

사용 시점:

- 문서 작성
- 설계 검토
- 계획 정리

필요 프로세스:

- 없음

검증:

- 문서 일관성
- 경로 / 용어 / 선행조건 확인

### Mode B. CLI / Runtime

사용 시점:

- headless mutation
- runtime contract
- canonical DB query / mutation

필요 프로세스:

- 가능하면 in-process CLI 만

검증:

- CLI 결과 JSON
- revision / conflict / changed set

### Mode C. Web / Adapter

사용 시점:

- Next.js app
- HTTP render adapter
- WS invalidate path

필요 프로세스:

- `bun dev` 전체 또는 필요한 부분만

검증:

- route / projection / subscription
- adapter posture

### Mode D. Desktop Host

사용 시점:

- Electron host/main process
- IPC
- desktop bootstrap

필요 프로세스:

- desktop host
- 필요한 경우 하위 HTTP / WS child process

검증:

- renderer <-> host 경계
- backend lifecycle
- workspace selection / desktop session

핵심 원칙은 하나다.

- **항상 가장 작은 모드부터 시작한다.**

## 3.4 Verification Layer

하네스는 "코드가 바뀌었다"가 아니라 "요청이 충족됐다"를 검증해야 한다.

우리 프로젝트에서는 검증도 모드별로 다르게 잡아야 한다.

- Docs mode
  - 문서 간 용어, 경로, 단계 일치
- CLI/runtime mode
  - JSON output, revision, changed set
- Web/adapter mode
  - route, query, subscription
- Desktop mode
  - host lifecycle, IPC, bootstrap

## 3.5 Artifact Layer

하네스는 매 작업마다 결과를 남겨야 한다.

최소 산출물:

- 어떤 모드로 작업했는가
- 어떤 명령을 실행했는가
- 어떤 검증이 통과/실패했는가
- 아직 남은 리스크가 무엇인가

이 프로젝트는 문서 중심 문화가 있으므로, 중요한 작업은 `docs/reports` 나 feature-local 문서에 짧게라도 남기는 방식이 잘 맞는다.

## 4. 실제로 작업할 때 어떻게 진행하면 좋은가

아래는 이 저장소에서 하네스를 실제로 운용할 때 권장 절차다.

## Step 1. 먼저 task 유형을 고른다

질문:

- 문서 작업인가?
- runtime / CLI 작업인가?
- web adapter 작업인가?
- desktop host 작업인가?

이걸 먼저 고르지 않으면, 에이전트는 필요 이상으로 많은 프로세스를 띄우게 된다.

## Step 2. 최소 실행 모드를 선택한다

권장 규칙:

- 문서면 앱을 띄우지 않는다
- CLI/runtime 이면 브라우저를 띄우지 않는다
- web adapter 면 desktop host 까지 띄우지 않는다
- desktop host 면 host 중심으로 보고, renderer-only 관점으로 작업하지 않는다

## Step 3. 검증 기준을 먼저 적는다

예:

- "routes.ts 가 더 이상 구현 허브가 아니어야 한다"
- "CLI가 revision-aware JSON을 반환해야 한다"
- "renderer가 runtime owner 역할을 하지 않아야 한다"
- "`compatibility-mutation` 사용처가 줄어야 한다"

OpenAI 글에서 말하는 것처럼, 에이전트가 잘 일하려면 "무엇을 만들지" 뿐 아니라 **무엇을 만족하면 끝인지** 가 먼저 주어져야 한다.

## Step 4. 작업 중간에 상태를 남긴다

특히 long-running / multi-process task 는 중간 상태 기록이 중요하다.

남겨야 하는 것:

- 지금 어떤 프로세스를 띄웠는가
- 어떤 health check 를 통과했는가
- 어디서 실패했는가
- 다음에 재개할 때 무엇부터 봐야 하는가

## Step 5. 결과는 코드/문서/검증으로 나눈다

최종 보고는 아래 세 줄로 압축되는 게 좋다.

- 무엇을 바꿨는가
- 무엇으로 검증했는가
- 아직 남은 리스크는 무엇인가

## 5. 이 프로젝트에서 권장하는 실행 규칙

## 5.1 CLI-first

AI 에이전트 관련 task 는 가능한 한 `CLI-first` 로 푼다.

이유:

- 구조적으로 가장 안정적이다
- machine-readable 하다
- runtime ownership 방향과 맞는다

## 5.2 Desktop는 host-first

desktop 관련 task 는 renderer 중심이 아니라 **host-first** 로 본다.

좋은 질문:

- host 가 어떤 프로세스를 띄우는가
- IPC contract 는 무엇인가
- renderer 는 무엇을 몰라야 하는가

## 5.3 Web는 adapter-first

web 관련 task 는 "웹이 진짜 소유자인가?"가 아니라 "웹이 어떤 adapter 인가?"로 본다.

즉 HTTP/WS task 는 ownership task 가 아니라 access / invalidate task 로 다루는 것이 맞다.

## 5.4 Compatibility는 분리해서 본다

compatibility 관련 task 는 항상 별도로 태깅해야 한다.

질문:

- 이 작업이 runtime-only 경로를 강화하는가?
- 아니면 legacy compatibility 를 유지/확산시키는가?

이 질문 없이 작업하면 과도기 코드가 계속 늘어난다.

## 6. 하지 말아야 할 것

- 모든 task 에서 full stack 을 다 띄우기
- 에이전트가 DB를 직접 수정하게 하기
- renderer 를 runtime owner 처럼 다루기
- compatibility 경로를 "임시니까 괜찮다"며 방치하기
- 검증 없이 문서/코드만 바꾸고 끝내기
- 실패 로그를 남기지 않고 세션을 넘기기

## 7. 우리 프로젝트에서 추천하는 도입 순서

1. 하네스에 `task mode selection` 을 도입한다
2. 모드별 최소 부팅 규칙을 문서화한다
3. 모드별 검증 체크리스트를 만든다
4. CLI-first / host-first / adapter-first 원칙을 AGENTS/문서에 반영한다
5. compatibility task tagging 을 도입한다
6. 그 다음에만 더 긴 복구 루프나 evaluator 루프를 붙인다

## 8. 최종 권장안

이 프로젝트에서 좋은 하네스는 아래처럼 동작해야 한다.

- 문서 task 는 문서만 다룬다
- runtime task 는 CLI로 검증한다
- web task 는 adapter만 띄운다
- desktop task 는 host를 기준으로 본다
- compatibility task 는 legacy 제거 관점으로 분리한다
- 결과는 항상 검증과 함께 남긴다

짧게 말하면:

- 하네스는 "에이전트가 셸을 더 많이 치게 하는 장치"가 아니다
- 하네스는 "이 저장소의 구조와 방향에 맞는 작업 루틴을 강제하는 운영 시스템" 이어야 한다

이 기준으로 가면, AI 에이전트는 이 프로젝트에서 더 빠르게 일하는 것보다 먼저 **틀리지 않게** 일하게 된다.
