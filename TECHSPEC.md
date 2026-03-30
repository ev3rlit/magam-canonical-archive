# Magam TECHSPEC

Magam의 canvas-first MVP와 이후 확장을 이끄는 루트 기준 기술 문서입니다. 이 문서는 제품 방향, 핵심 차별점, 시스템 계약을 함께 고정하는 이정표이자 north star 문서로 사용합니다.

## 1. 제품 정의

Magam은 데이터 중심(Data-Driven), 로컬 우선(Local-First), 헤드리스 에이전틱 캔버스 애플리케이션입니다.

- 사람은 GUI에서 캔버스를 보고 선택하고 조작합니다.
- AI 에이전트는 같은 캔버스를 구조화된 명령으로 읽고 수정합니다.
- Magam은 앱 내부에서 AI 프록시, 모델 중계, 자체 구독 레이어를 제공하지 않습니다.
- 사용자는 Codex, Claude Code, Codex CLI, Gemini, Claude Desktop 등 자신이 주로 사용하는 AI 클라이언트를 그대로 활용하는 BYOC(Bring Your Own Client) 모델을 사용합니다.
- 사용자는 자신이 이미 보유한 구독 모델 또는 API 키를 사용하며, Magam은 모델 호출의 과금/인증 주체가 되지 않습니다.
- GUI와 CLI는 공통 service layer 및 domain layer를 경유해 동작하며, 내부 런타임이 direct mode인지 coordinated mode인지 알 필요가 없습니다.
- 캔버스의 진실의 원천(Source of Truth)은 화면이 아니라 데이터 모델입니다.

## 2. 핵심 킬러 피쳐

Magam의 차별점은 "AI가 캔버스를 다룰 수 있게 하는 것"에 그치지 않습니다. 사람과 AI가 같은 캔버스를 안전하게, 실시간으로, 구조적으로 협업할 수 있도록 캔버스 런타임 자체를 다시 설계하는 데 있습니다.

### 2.1 High-Level Placement System

AI는 좌표가 아니라 의미 기반 배치 규칙으로 동작해야 합니다.

- `anchor`: 특정 노드 주변에 주석, 파생 아이디어 같은 독립 요소를 배치합니다.
- `attach`: 부모 노드에 귀속되는 배지, 태그, 메타데이터를 부착합니다.
- `group`: 논리적인 묶음을 형성하고 레이아웃 단위로 다룹니다.
- `jitter`: 그룹 내부 요소들에 미세한 transform 차이를 주어 자연스러운 시각 효과를 만듭니다.

최종 좌표 계산, 충돌 회피, 배치 해석은 레이아웃 엔진이 담당합니다.

이 기능이 중요한 이유는 다음과 같습니다.

- AI가 직접 픽셀 좌표를 계산하지 않아도 됩니다.
- 복잡한 캔버스를 토큰으로 직렬화해 위치를 설명하는 비용을 줄입니다.
- 사람은 시각적 결과를 보고, AI는 구조적 의도를 다루는 역할 분리가 가능합니다.

### 2.2 Contextual State Sync

사용자 인터랙션 상태는 공유 가능한 런타임 컨텍스트로 저장되어야 합니다.

- 현재 선택과 포커스 상태를 editor state로 데이터베이스에 기록합니다.
- 에이전트는 `get-active-context` 같은 명령으로 현재 작업 맥락을 조회합니다.
- 사용자가 선택 데이터를 복사해서 프롬프트에 붙여넣는 과정은 없어야 합니다.

이 기능이 중요한 이유는 다음과 같습니다.

- 사람의 현재 작업 의도가 시스템 안에서 즉시 데이터화됩니다.
- AI는 화면 스크린샷이나 장문의 컨텍스트 설명 없이도 현재 작업 대상을 알 수 있습니다.
- GUI와 CLI가 같은 작업 맥락을 공유하는 진정한 협업 루프가 만들어집니다.

### 2.3 Sync Notify via gRPC Server Streaming

커밋된 변경은 연결된 모든 클라이언트에 거의 즉시 반영되어야 합니다.

- 호스트는 gRPC 스트리밍으로 delta 이벤트를 브로드캐스트합니다.
- GUI 클라이언트는 이 이벤트를 구독해 렌더 상태를 갱신합니다.
- AI가 만든 변경은 커밋 직후 화면에 반영되어야 합니다.

이 기능이 중요한 이유는 다음과 같습니다.

- 폴링이나 별도 웹소켓 서버 없이 실시간 동기화를 구현할 수 있습니다.
- 로컬 IPC 기반 환경에서도 안정적인 publish/subscribe 흐름을 유지할 수 있습니다.
- "터미널에서 AI가 명령하면 눈앞의 캔버스가 즉시 바뀌는 경험"을 제품의 핵심 체험으로 만들 수 있습니다.

### 2.4 Multiplayer Concurrency & Intent

AI를 독립적인 협업자로 통합하기 위해, 시스템은 단순 CRUD를 넘어 협업 의도와 충돌 제어를 모델링해야 합니다.

#### 2.4.1 Presence: 가상 커서와 상태 브로드캐스팅

Presence는 누가 어떤 타겟을 작업 중인지 선언하는 협업 상태입니다.

- CLI 예시 명령:

```bash
canvas-cli presence --target {id} --status "analyzing"
```

- 최소 필드:
  - `actor`
  - `session_id`
  - `target_id`
  - `status`
  - `updated_at`
  - `expires_at`
- `status`는 최소한 `analyzing`, `editing`, `proposing`, `idle` 상태를 지원해야 합니다.
- 호스트는 presence를 저장하고 `SubscribeUpdates` 스트림으로 관련 GUI 클라이언트에 브로드캐스트합니다.
- GUI는 대상 노드 근처에 "AI가 작업 중"에 해당하는 시각적 피드백을 표시해야 합니다.
- presence는 하드 락이 아니라 소프트 시그널입니다. 편집을 물리적으로 차단하기보다 충돌 가능성을 사람과 AI 모두에게 드러내는 역할을 합니다.
- 오래된 세션이 남지 않도록 heartbeat 또는 만료 시각 기반 정리가 필요합니다.

#### 2.4.2 Optimistic Locking: 낙관적 동시성 제어

모든 canonical object는 버전 기반 충돌 감지를 지원해야 합니다.

- 모든 오브젝트 레코드는 `version` 필드를 가집니다.
- CLI 또는 GUI에서 보내는 mutation은 `base_version`을 필수로 포함해야 합니다.
- 호스트는 `base_version == current_version`인 경우에만 트랜잭션을 커밋합니다.
- 버전이 불일치하면 커밋을 거부하고 structured conflict 응답을 반환합니다.

충돌 응답은 최소한 다음 정보를 포함해야 합니다.

- `target_id`
- `expected_version`
- `actual_version`
- `latest_payload`
- `updated_by`
- `updated_at`

CLI 예시 명령:

```bash
canvas-cli mutate --target {id} --base-version 12 --payload "{...}"
```

충돌 이후 클라이언트는 다음 중 하나를 선택할 수 있어야 합니다.

- 최신 상태를 읽고 새 `base_version`으로 재시도
- 즉시 커밋 대신 proposal mode로 전환
- 사용자 승인 또는 확인을 요청

#### 2.4.3 Proposal Mode: 제안 및 초안 시스템

Proposal mode는 대규모 구조 변경이나 파괴적 변경을 즉시 커밋하지 않고 초안 상태로 다루는 메커니즘입니다.

- CLI 예시 명령:

```bash
canvas-cli propose --target {id} --base-version 12 --payload "{...}"
```

- proposal은 canonical object를 즉시 덮어쓰지 않습니다.
- proposal은 별도 proposal record 또는 patch set으로 저장되어야 합니다.
- GUI는 proposal을 ghost UI로 렌더링해 기존 상태와 구분해서 보여줘야 합니다.
- 사용자가 `Accept`를 눌렀을 때만 proposal이 실제 canonical state에 merge 됩니다.
- 사용자가 `Reject`를 선택하면 proposal은 폐기되며 canonical state는 유지됩니다.

proposal record는 최소한 다음 메타데이터를 가져야 합니다.

- `proposal_id`
- `actor`
- `target_scope`
- `base_version`
- `payload`
- `created_at`
- `status`

Accept 시점에도 optimistic locking을 다시 검사해야 합니다.

- proposal 생성 이후 원본이 바뀌었다면 자동 merge 하지 않습니다.
- 이 경우 proposal은 `stale` 또는 `conflicted` 상태로 전환되고 사용자에게 재검토를 요구합니다.

#### 2.4.4 Actor-based Audit: 행위자 기반 추적

모든 쓰기 작업은 누가 만들었는지 추적 가능해야 합니다.

- 모든 mutation, placement, proposal, accept, reject, rollback은 `actor` 메타데이터를 남겨야 합니다.
- `actor`는 최소한 `human`, `claude-code`, `chatgpt` 같은 주체 구분을 지원해야 합니다.
- 감사 로그는 write path의 부가 기능이 아니라 기본 산출물이어야 합니다.

감사 이벤트는 최소한 다음 정보를 포함해야 합니다.

- `event_id`
- `actor`
- `action`
- `target_id` 또는 `target_scope`
- `base_version`
- `result_version`
- `timestamp`
- `payload_summary`

이 메커니즘은 다음 용도를 지원해야 합니다.

- 특정 actor가 만든 변경만 필터링
- 특정 actor의 작업만 선택적으로 롤백
- 사람과 AI의 개입 순서 추적
- proposal에서 최종 승인된 변경의 출처 추적

#### 2.4.5 협업 제어 원칙

- presence는 충돌을 알리기 위한 소프트 제어이고, 실제 무결성은 version 기반 locking이 보장합니다.
- proposal은 "안전한 대규모 변경"을 위한 기본 경로이며, destructive operation에서는 일반 mutation보다 우선 고려해야 합니다.
- audit trail은 사후 분석용 로그가 아니라 undo/redo, trust, review를 떠받치는 데이터 기반입니다.
- 협업 제어 메커니즘은 인간 사용자에게만 보이는 UX가 아니라 AI 클라이언트도 직접 읽고 쓸 수 있는 시스템 계약이어야 합니다.

## 3. 제품 특징

핵심 킬러 피쳐 외에도, Magam은 AI 시대의 로컬 캔버스 도구로서 다음 특징을 제품 원칙으로 가집니다.

### 3.1 BYOC AI 클라이언트 모델

Magam은 AI 기능을 앱 내부 프록시로 제공하지 않습니다.

- 모델 추론은 Magam 앱 내부에서 수행하지 않습니다.
- 사용자는 자신이 익숙한 외부 AI 클라이언트에서 계속 작업합니다.
- 대표 대상은 Codex, Claude Code, Codex CLI, Gemini, Claude Desktop 등 채팅 입력 기반의 AI 앱입니다.
- Magam은 특정 모델 공급자에 종속된 AI 앱이 아니라, 캔버스 협업을 위한 runtime and integration layer입니다.

### 3.2 사용자 소유 구독 및 API 키

Magam은 사용자 대신 AI 구독을 판매하거나 API 호출을 중계하지 않습니다.

- 사용자는 자신이 이미 지불하고 있는 구독 모델을 그대로 활용합니다.
- API 기반 사용자는 자신의 API 키를 기존 AI 클라이언트 또는 워크플로우 안에서 그대로 사용합니다.
- Magam은 모델 사용량을 프록시 과금하거나 벤더별 billing gateway 역할을 하지 않습니다.
- 이 구조는 사용자 선택권을 높이고, 특정 AI 벤더나 앱 정책에 대한 종속을 낮춥니다.

### 3.3 채팅 입력 기반 워크플로우

사용자는 새로 만든 전용 채팅 UI를 배우는 대신, 평소 사용하던 앱에서 자연어로 작업을 지시합니다.

- 채팅 입력은 외부 AI 클라이언트에서 발생합니다.
- 외부 AI 클라이언트는 Magam CLI 또는 구조화된 RPC를 통해 캔버스에 접근합니다.
- Magam 앱은 채팅 인터페이스보다 캔버스 상태, 협업 맥락, 동기화, 렌더링에 집중합니다.
- 이 모델은 사용자의 기존 습관을 유지하면서도 캔버스 조작만 제품 고유 역량으로 집중하게 만듭니다.

### 3.4 클라이언트 독립적인 통합 표면

Magam은 특정 AI 앱 하나에 맞춰진 일회성 연결이 아니라, 여러 AI 클라이언트가 공유할 수 있는 통합 표면을 제공합니다.

- CLI 명령과 Protobuf/gRPC 계약이 공통 인터페이스 역할을 합니다.
- 하나의 워크스페이스를 여러 AI 클라이언트가 같은 방식으로 읽고 쓸 수 있습니다.
- 모델 공급자나 채팅 앱이 바뀌어도, 캔버스 쪽 시스템 계약은 유지됩니다.
- 결과적으로 Magam의 핵심 자산은 "내장 AI UI"가 아니라 "AI가 신뢰할 수 있는 캔버스 런타임"이 됩니다.

### 3.5 런타임 구현 분리

Magam 앱은 내부 런타임 구현보다 service/domain contract를 우선합니다.

- GUI 에디터 단독 실행에서는 Houston 없이 direct runtime으로 동작할 수 있습니다.
- CLI와 함께 멀티프로세스 협업이 필요할 때만 coordinated runtime 또는 Houston orchestration을 사용할 수 있습니다.
- 앱 레이어는 `localhost` 서버, IPC 소켓 서버, in-process DB 접근 같은 내부 차이를 직접 알지 않습니다.
- 런타임 선택은 infrastructure concern이고, 제품 동작 규칙은 service layer와 domain layer에 남아 있어야 합니다.

### 3.6 멀티패널 에디터 셸

Magam은 Unity 같은 게임 엔진 에디터를 참고한 멀티패널 에디터 셸 방향을 가집니다.

- 캔버스는 핵심 작업 표면이지만, 에디터 안의 여러 위젯/패널 중 하나로 동작할 수 있습니다.
- Hierarchy, Inspector, Explorer 같은 보조 윈도우는 같은 canonical canvas data를 각기 다른 관점으로 투영합니다.
- 이 구조는 canvas-first 경험을 유지하면서도 복잡한 편집 책임을 여러 패널로 분리할 수 있게 합니다.

## 4. 기술 스택

초기 MVP 기준 기술 스택은 다음과 같습니다.

### 4.1 애플리케이션 런타임

- Core runtime / CLI: Node.js
- 역할: application service host, CLI 실행, direct runtime 또는 coordinated runtime 실행 담당

### 4.2 데이터베이스

- Embedded database: PGlite
- 역할: 단일 워크스페이스의 canonical canvas data, 관계 데이터, editor state 저장
- 선택 이유: 임베디드 PostgreSQL 계열 런타임으로 JSONB 활용이 가능하고, 향후 ORM/쿼리 생태계 확장이 용이함
- 비고: Houston 계층은 DB 엔진과 느슨하게 분리되므로, 장기적으로 다른 로컬 DB 엔진을 검토할 수 있으나 현재 MVP 기준 타깃은 PGlite입니다.

### 4.3 프로세스 간 통신

- RPC / streaming: gRPC + Protobuf
- Transport: IPC 기반 Unix domain socket 또는 named pipe
- 역할: coordinated runtime에서 호스트와 GUI/CLI/에이전트 간 요청, 응답, delta streaming 전달
- 선택 이유: 강한 계약, 로컬 소켓 통신, server streaming 기반 sync notify를 하나의 프로토콜로 통합 가능

### 4.4 런타임 모드

- Direct runtime:
  - GUI 단독 실행 또는 단일 프로세스 시나리오에서 service layer가 in-process adapter를 통해 DB에 직접 접근
- Coordinated runtime:
  - CLI와 GUI가 함께 동작하거나, 임베디드 DB 제약 때문에 단일 write owner가 필요한 경우 orchestration layer를 통해 접근
- 원칙:
  - 두 모드는 같은 application service contract와 domain rules를 공유해야 합니다.

### 4.5 프론트엔드 렌더링

- Frontend: React / TSX
- 역할: 데이터베이스 상태를 읽어 캔버스를 렌더링하는 뷰 계층

### 4.6 데스크톱 패키징

- Desktop shell: Electron
- 역할: 로컬 데스크톱 앱 패키징, OS 수준 IPC 접근, 네이티브 앱 실행 환경 제공
- 상태: 최종 선택은 구현 단계에서 개발 생산성과 IPC 제약을 기준으로 확정

## 5. 해결하려는 문제와 해결 방식

### 5.1 GUI 중심 캔버스의 한계

기존 캔버스 툴은 사람의 마우스 드래그와 픽셀 단위 좌표 입력을 전제로 설계되어 있습니다.

- AI는 안정적인 좌표 계산에 약하고, 복잡한 배치에서 환각(Hallucination)이 발생하기 쉽습니다.
- 큰 캔버스 맥락을 프롬프트에 그대로 담으면 토큰 비용이 과도하게 커집니다.
- 많은 도구가 구조적 편집보다 수동 배치에 최적화되어 있습니다.

해결 방식은 다음과 같습니다.

- AI는 좌표를 직접 계산하지 않고 `anchor`, `attach`, `group`, `jitter` 같은 high-level placement 명령만 생성합니다.
- 최종 좌표 계산, 충돌 회피, 배치 해석은 레이아웃 엔진이 담당합니다.
- 사용자의 현재 선택과 포커스는 editor state로 저장되어, AI가 거대한 화면 컨텍스트를 프롬프트로 다시 전달받지 않아도 됩니다.
- 캔버스 변경은 `MutateNode`, `PlaceObject` 같은 구조화된 RPC로 표현되어, 자유형 좌표 조작보다 안정적인 편집 경로를 제공합니다.

### 5.2 과도한 AI 통합 복잡도

기존 AI 캔버스 제품은 앱 내부에 채팅 UI, 프록시 서버, 별도 런타임을 과도하게 넣는 경향이 있습니다.

- 시스템이 불필요하게 무거워집니다.
- 사용자가 이미 익숙한 외부 AI 도구를 재사용하기 어려워집니다.

해결 방식은 다음과 같습니다.

- Magam은 BYOC 모델을 채택해 Codex, Claude Code, Codex CLI, Gemini, Claude Desktop 같은 외부 AI 클라이언트를 그대로 사용합니다.
- GUI는 캔버스를 보여주는 뷰와 인터랙션 계층에 집중하고, AI 실행 환경은 외부 클라이언트에 맡깁니다.
- Magam은 자체 AI proxy나 model relay 계층을 두지 않으며, 사용자의 구독 모델 또는 API 키는 사용자가 선택한 외부 클라이언트 쪽에서 관리합니다.
- 프로세스 간 연동은 gRPC 계약만 공유하므로, 앱 내부에 별도 채팅 셸이나 무거운 프록시 계층을 넣지 않아도 됩니다.
- `.proto` 파일이 곧 API 문서이자 스키마 역할을 하므로, 느슨한 JSON 기반 통합보다 안정적인 인터페이스를 유지할 수 있습니다.

### 5.3 로컬 멀티 프로세스 협업 문제

임베디드 DB는 일반적으로 다중 프로세스 쓰기 경쟁과 잠금 충돌에 취약합니다.

- GUI 앱과 AI 에이전트가 같은 워크스페이스를 직접 동시에 수정하면 충돌 가능성이 높습니다.
- 이를 해결하기 위해서는 별도 데몬 관리나 포트 충돌 없이 단일 조정자(coordinator)가 필요합니다.

해결 방식은 다음과 같습니다.

- GUI 단독 실행에서는 direct runtime으로 동작해 불필요한 오케스트레이션 계층 없이 처리할 수 있습니다.
- 멀티프로세스 협업이나 DB 제약 때문에 단일 write owner가 필요할 때만 Houston 동적 오케스트레이션을 사용합니다.
- coordinated runtime에서는 가장 먼저 실행된 프로세스가 호스트로 승격되어 DB를 독점 마운트합니다.
- 후발 프로세스는 DB를 직접 열지 않고 로컬 IPC 소켓을 통해 호스트에 gRPC 클라이언트로 접속합니다.
- 통신은 TCP 포트가 아니라 Unix domain socket 또는 Windows named pipe를 사용하므로 방화벽 경고와 포트 충돌이 없습니다.
- DB 변경 알림은 gRPC server streaming으로 전파되므로, 폴링이나 별도 웹소켓 서버 없이도 실시간 동기화가 가능합니다.
- Protobuf 직렬화 단계에서 잘못된 구조의 요청을 차단해, 오염된 입력이 비즈니스 로직이나 DB까지 도달하는 것을 줄입니다.

### 5.4 협업 의도(Intent)와 변경 충돌 제어 부재

AI를 단순한 도구가 아니라 독립적인 협업자로 다루려면, "누가 무엇을 만지고 있는지", "지금 바로 써도 되는지", "덮어쓰기 전 사용자 승인이 필요한지"가 시스템에 표현되어야 합니다.

- 일반적인 캔버스 툴은 AI가 어떤 노드를 읽고 있거나 수정 중인지 사용자에게 보여주지 못합니다.
- 사람과 AI가 같은 노드를 거의 동시에 수정할 때, 마지막 쓰기 승리(last write wins) 방식은 데이터 손실을 만들기 쉽습니다.
- 대규모 구조 변경은 즉시 커밋되면 위험하지만, 임시 초안 상태와 승인 흐름이 없으면 안전하게 제안하기 어렵습니다.
- 나중에 "누가 이 변경을 만들었는지" 추적하거나 특정 에이전트의 작업만 롤백하기도 어렵습니다.

해결 방식은 다음과 같습니다.

- Presence 모델을 도입해 AI 또는 사용자가 특정 타겟에 대해 작업 중임을 선언하고, GUI에 실시간으로 브로드캐스트합니다.
- 모든 쓰기 요청은 `base_version`을 포함하고, 오브젝트는 `version` 필드를 가져 optimistic locking으로 충돌을 감지합니다.
- 대규모 변경은 proposal mode로 먼저 제출하고, GUI에서는 ghost UI로 시각화한 뒤 사용자가 승인할 때만 실제 상태에 merge 합니다.
- 모든 쓰기 작업은 `actor` 메타데이터와 감사 이벤트를 남겨 actor-based audit trail을 구성합니다.

## 6. 제품 목표

- 사람과 AI가 같은 캔버스를 실시간으로 협업할 수 있어야 합니다.
- 클라우드 제어 평면 없이도 동작하는 로컬 우선 런타임을 유지합니다.
- 좌표 중심 편집이 아니라 데이터 중심 편집을 기본 모델로 삼습니다.
- 어떤 클라이언트든 엄격한 타입 계약을 통해 워크스페이스에 참여할 수 있어야 합니다.
- 사용자가 이미 사용하는 AI 앱, 구독 모델, API 키를 그대로 활용할 수 있어야 합니다.
- GUI와 CLI는 동일한 application service contract를 사용해야 하며, 런타임 구현 방식은 하위 계층으로 격리되어야 합니다.
- 상태 변경과 동기화는 단일 진실의 원천 아래에서 일관되게 처리되어야 합니다.

## 7. 비목표

- 앱 내부에 독자적인 올인원 AI 채팅 셸을 만드는 것
- 앱이 모델 호출을 프록시하거나 자체 AI 구독/과금 레이어를 제공하는 것
- 사용자가 새로운 전역 AI 런타임이나 무거운 MCP 구성을 강제당하는 것
- 사용자를 특정 AI 벤더나 특정 채팅 앱에 묶는 것
- GUI 단독 실행에도 항상 Houston 같은 orchestration 계층을 강제하는 것
- AI가 직접 픽셀 좌표를 계산하는 모델을 기본 인터페이스로 삼는 것
- 기본 단일 머신 시나리오에서 네트워크 포트를 열어 동기화하는 것

## 8. 핵심 아키텍처

### 8.1 서비스/도메인 경계와 런타임 모드

Magam의 애플리케이션은 내부 실행 방식보다 service layer와 domain layer를 기준으로 동작합니다.

- GUI와 CLI는 공통 application service contract를 호출합니다.
- domain rules는 placement, conflict, proposal, presence, audit와 같은 제품 규칙을 담당합니다.
- infrastructure layer는 direct runtime과 coordinated runtime 중 어떤 구현을 쓸지 선택합니다.
- 이 구조에서 앱은 내부가 in-process DB 접근인지, 로컬 소켓 기반 orchestration인지 직접 알지 않습니다.

권장 분리는 다음과 같습니다.

- Domain layer:
  - canvas object
  - version/conflict
  - proposal
  - audit
  - presence 규칙
- Application / Service layer:
  - `mutateNode`
  - `placeObject`
  - `declarePresence`
  - `getActiveContext`
  - `proposeChange`
  - `acceptProposal`
- Infrastructure adapters:
  - direct adapter
  - houston adapter
  - future remote adapter

이 구조의 핵심 원칙은 다음과 같습니다.

- Houston은 business logic을 소유하지 않습니다.
- Houston은 필요할 때 transport, host election, streaming, process coordination을 담당하는 선택 가능한 orchestration mode입니다.
- direct mode와 coordinated mode는 같은 service/domain contract를 공유해야 합니다.

### 8.2 Houston 동적 오케스트레이션

Magam은 필요할 때 Houston이라는 동적 호스트/클라이언트 오케스트레이션 모델을 사용할 수 있습니다.

- direct runtime만으로 충분한 경우 Houston은 필수 구성요소가 아닙니다.
- CLI와 함께 멀티프로세스 협업이 필요하거나, 임베디드 DB의 write ownership 제약을 우회해야 할 때 Houston을 활성화합니다.
- 워크스페이스를 가장 먼저 연 프로세스가 호스트가 됩니다.
- 호스트는 임베디드 데이터베이스 런타임을 독점적으로 소유합니다.
- 이후 실행되는 프로세스는 DB를 직접 열지 않고 클라이언트로 접속합니다.
- 호스트와 클라이언트는 별도 제품이 아니라 런타임 역할입니다.

이 구조는 분산 시스템의 leader election 또는 dynamic hosting 패턴을 로컬 워크스페이스 환경에 적용한 것입니다.

고정된 데몬 서버를 전제로 하지 않고, 누구든 먼저 깨어난 프로세스가 오케스트레이터가 되고 후발주자는 클라이언트로 합류합니다. 이 접근은 실시간 상태 동기화와 빠른 트랜잭션 처리가 중요한 이벤트 기반 시스템에 적합하며, 로컬 캔버스 앱에서는 특히 임베디드 DB의 파일 잠금 문제를 우아하게 우회합니다.

현재 MVP에서는 PGlite를 기준으로 설계하지만, Houston 패턴 자체는 "단일 프로세스가 임베디드 DB를 소유하고 나머지는 IPC를 통해 접근한다"는 원칙에 기반하므로 다른 로컬 DB 엔진을 검토하더라도 동일한 구조적 이점을 유지할 수 있습니다.

동작 순서는 다음과 같습니다.

1. 프로세스가 시작되면 먼저 약속된 로컬 소켓에 연결을 시도합니다.
2. 연결에 성공하면 이미 활성 호스트가 존재한다는 뜻이므로 클라이언트 모드로 동작합니다.
3. 연결이 거절되거나 소켓이 없으면 스스로 호스트로 승격합니다.
4. 호스트는 즉시 DB를 로드하고 파일 락을 단독으로 소유한 뒤, 소켓 서버를 열어 후속 클라이언트를 받습니다.

#### 8.2.1 Ping & Bind

Houston의 핵심 시작 절차는 Ping & Bind입니다.

- GUI 또는 CLI는 실행 즉시 약속된 로컬 IPC 소켓에 연결을 시도합니다.
- 이 소켓은 Unix 계열에서는 예를 들어 `/tmp/canvas.sock`, Windows에서는 named pipe와 같은 로컬 전용 엔드포인트가 됩니다.
- 연결 성공은 "이미 누군가가 DB 락을 쥐고 호스트로 동작 중"이라는 의미입니다.
- 연결 실패는 "현재 활성 오케스트레이터가 없음"을 의미하며, 이때 해당 프로세스가 스스로 호스트로 승격합니다.

#### 8.2.2 Client 모드와 Host 모드 승급

Houston은 별도 런처나 수동 역할 선택 없이 프로세스가 스스로 역할을 결정합니다.

- Client 모드 승급:
  - 소켓 연결이 성공하면 데이터베이스 엔진을 직접 열지 않습니다.
  - 해당 프로세스는 클라이언트 에이전트가 되어 필요한 명령만 호스트에 전달합니다.
  - 이 경로는 GUI가 후발주자인 경우에도, CLI가 후발주자인 경우에도 동일합니다.
- Host 모드 승급:
  - 소켓 연결이 거절되거나 엔드포인트가 없으면 해당 프로세스가 호스트가 됩니다.
  - 호스트는 즉시 임베디드 DB를 로드하고 파일 락을 단독으로 획득합니다.
  - 이어서 자신이 직접 소켓 서버를 열고 후속 프로세스의 연결을 대기합니다.

#### 8.2.3 Houston이 해결하는 운영 문제

이 구조가 제공하는 운영상 이점은 다음과 같습니다.

- Zero-Setup:
  - 사용자는 데몬을 미리 띄우거나 역할을 선택할 필요가 없습니다.
  - GUI를 먼저 열든, CLI에서 AI 명령을 먼저 실행하든 시스템이 자동으로 단일 호스트를 합의합니다.
- 충돌 없는 데이터 무결성:
  - 언제나 하나의 프로세스만 임베디드 DB를 직접 조작합니다.
  - 나머지 프로세스는 IPC를 통해 명령을 위임하므로 파일 잠금 충돌이 물리적으로 줄어듭니다.
- 단순한 운영 모델:
  - 별도 포트 관리, 외부 데몬 헬스체크, 사용자 수동 복구 절차가 필요 없습니다.
  - 로컬 앱의 실행 순서 자체가 호스트 선출 메커니즘이 됩니다.

### 8.3 통신 모델

프로세스 간 통신은 로컬 IPC 기반 gRPC로 처리합니다.

- Unix 계열에서는 Unix domain socket, Windows에서는 named pipe를 사용합니다.
- TCP 포트 바인딩은 기본적으로 필요하지 않습니다.
- 모든 요청과 이벤트는 Protobuf 계약을 통해 전달됩니다.
- 이 방식은 방화벽 이슈와 로컬 포트 충돌을 줄이고, 프로세스 경계를 명확하게 유지합니다.

gRPC를 채택하는 이유는 다음과 같습니다.

- Protobuf가 강한 타입 계약과 명세 역할을 동시에 제공하므로, 느슨한 JSON 프로토콜보다 인터페이스가 안정적입니다.
- 잘못된 구조나 타입의 요청은 직렬화/역직렬화 단계에서 빠르게 차단됩니다.
- HTTP/2 기반 streaming RPC를 활용해 `SubscribeUpdates` 같은 실시간 구독 API를 단순하게 구현할 수 있습니다.
- 로컬 IPC transport 위에서도 동일한 계약을 유지할 수 있어, 네트워크 버전과 로컬 버전이 다른 프로토콜을 가질 필요가 없습니다.

direct runtime에서는 동일한 service/domain contract가 in-process adapter를 통해 실행되며, GUI는 별도 로컬 서버가 있는지 여부를 신경 쓰지 않습니다.

### 8.4 단일 진실의 원천

- 데이터베이스가 캔버스 상태의 canonical store입니다.
- GUI는 DB 상태를 읽어 렌더링하는 뷰 계층입니다.
- 에이전트는 UI 내부 메모리 상태를 직접 신뢰하지 않습니다.
- 모든 상태 변경은 application service contract를 통해서만 발생합니다.
- coordinated runtime에서는 이 서비스 호출이 호스트 런타임과 타입이 명시된 RPC 계약을 통해 실행됩니다.

### 8.5 프로세스 생명주기 정책

Houston은 호스트 선출뿐 아니라 호스트 종료 정책도 명확해야 합니다.

- GUI가 호스트가 된 경우에는 해당 워크스페이스 창이 열려 있는 동안 호스트 수명을 유지합니다.
- CLI가 호스트가 된 경우에는 기본적으로 요청 처리가 끝나고 활성 구독자가 없으면 즉시 graceful shutdown 하여 소켓과 DB 락을 해제합니다.
- 이후 GUI나 다른 CLI가 다시 실행되면 동일한 Ping & Bind 절차로 새 호스트를 선출합니다.
- 별도 백그라운드 데몬을 항상 유지하는 방식은 MVP 범위에서 제외합니다.

이 정책은 숨겨진 백그라운드 프로세스를 최소화하고, 로컬 앱이 스스로 호스트를 회복하도록 만드는 더 단순한 기본값입니다.

이 지점은 Houston 구현에서 가장 중요한 설계 포인트 중 하나입니다.

- GUI host lifecycle:
  - 사용자가 창을 닫기 전까지 호스트를 유지하는 것이 자연스럽습니다.
  - GUI는 장시간 열려 있는 상호작용 표면이므로 실시간 구독 유지와 잘 맞습니다.
- CLI host lifecycle:
  - CLI가 먼저 실행되어 호스트가 될 수는 있지만, MVP 기본 정책은 명령 처리 후 graceful shutdown 입니다.
  - 즉, AI의 단일 명령을 처리한 뒤 백그라운드 데몬으로 상주하도록 자동 fork 하지 않습니다.
  - 이 선택은 보이지 않는 잔류 프로세스를 줄이고, 디버깅과 사용자 인지 모델을 단순하게 유지합니다.
- 향후 확장 가능성:
  - CLI host를 짧은 TTL의 background daemon으로 승격하는 모델은 미래에 검토할 수 있습니다.
  - 다만 이는 세션 관리, orphan process 정리, 재연결 정책, 보안 경계까지 함께 설계되어야 하므로 MVP 기본값으로 두지 않습니다.

### 8.6 협업 제어 아키텍처

멀티플레이어 협업은 단순 실시간 렌더링이 아니라 presence, conflict control, proposal, audit를 포함하는 제어 계층으로 다룹니다.

- Presence는 actor가 특정 객체 또는 영역을 작업 중임을 선언하는 협업 상태입니다.
- Optimistic locking은 충돌을 감지하고, last write wins를 기본값으로 두지 않도록 강제합니다.
- Proposal은 canonical data를 즉시 덮어쓰지 않는 임시 변경 집합입니다.
- Audit trail은 모든 write의 주체와 결과를 복원 가능한 형태로 남깁니다.

이 네 가지는 각각 분리된 기능이 아니라 하나의 협업 트랜잭션 파이프라인으로 연결됩니다.

1. actor가 작업 전 presence를 선언합니다.
2. actor는 현재 `base_version`을 읽고 mutation 또는 proposal을 생성합니다.
3. 호스트는 버전 일치 여부를 검사합니다.
4. 즉시 커밋 가능한 변경은 canonical state에 반영합니다.
5. 승인형 변경은 proposal로 저장하고 ghost UI로 렌더링합니다.
6. 모든 결과는 actor 메타데이터와 함께 audit event로 남깁니다.

## 9. 런타임 구성요소

### 9.1 GUI 애플리케이션

- application service layer를 호출합니다.
- direct runtime에서는 in-process adapter를 통해 직접 동작합니다.
- coordinated runtime에서는 로컬 오케스트레이션 런타임을 호스팅하거나 여기에 접속합니다.
- 현재 캔버스 상태를 렌더링합니다.
- 선택 상태, 포커스 상태 같은 인터랙션 맥락을 기록합니다.
- 실시간 변경 이벤트를 구독하고 화면을 다시 그립니다.
- actor presence 상태를 시각적으로 표시합니다.
- proposal이 존재할 경우 ghost layer와 승인 UI를 렌더링합니다.
- conflict 발생 시 최신 상태, 충돌 원인, 재시도 경로를 사용자에게 노출합니다.

### 9.2 CLI / Agent Client

- application service contract를 통해 캔버스 변경을 요청합니다.
- coordinated runtime에서는 호스트에 gRPC 클라이언트로 접속합니다.
- 현재 사용자의 활성 컨텍스트를 읽습니다.
- 구조화된 명령으로 캔버스 변경을 요청합니다.
- GUI 안에 AI를 내장하지 않고 Codex, Claude Code, Codex CLI, Gemini, Claude Desktop 같은 외부 AI 클라이언트와 연동됩니다.
- 모델 선택, 인증, 과금은 Magam이 아니라 사용자가 선택한 외부 AI 클라이언트 또는 해당 클라이언트가 사용하는 계정/API 키 체계가 담당합니다.
- 변경 전에 presence를 선언할 수 있어야 합니다.
- mutation 또는 proposal 요청 시 `actor`, `base_version`, `target` 정보를 함께 전달해야 합니다.
- conflict 응답을 받으면 최신 상태를 기반으로 재시도하거나 proposal로 전환할 수 있어야 합니다.

### 9.3 임베디드 데이터베이스

- 대상 DB 런타임은 PGlite입니다.
- 캔버스 객체, 관계 정보, 에디터 상태를 저장합니다.
- 유연한 캔버스 페이로드 저장을 위해 JSONB를 활용합니다.

## 10. 사용자 워크플로우

GUI 에디터 단독 실행의 기본 흐름은 다음과 같습니다.

1. 사용자가 GUI에서 캔버스를 엽니다.
2. GUI는 application service layer를 통해 direct runtime으로 동작합니다.
3. service layer는 in-process adapter를 통해 DB와 상호작용합니다.
4. GUI는 동일한 domain rules를 사용해 편집, 충돌 검사, proposal 처리, audit 기록을 수행합니다.

1. 사용자가 GUI에서 캔버스를 열고 노드를 선택합니다.
2. GUI는 현재 선택 상태를 editor state로 저장합니다.
3. 사용자는 Codex, Claude Code, Codex CLI, Gemini, Claude Desktop 같은 외부 AI 클라이언트에서 자연어 명령을 입력합니다.
4. AI 클라이언트는 CLI를 통해 활성 컨텍스트를 읽고 변경 요청을 전송합니다.
5. 호스트는 요청을 검증하고 데이터베이스에 커밋합니다.
6. 연결된 GUI 클라이언트는 delta 이벤트를 받아 캔버스를 다시 렌더링합니다.

CLI가 먼저 실행되는 경우의 흐름도 동일한 원리로 동작합니다.

1. CLI가 먼저 실행되면 로컬 소켓 연결을 시도합니다.
2. 연결 대상이 없으면 CLI가 임시 호스트로 승격해 DB를 마운트합니다.
3. 명령을 처리하는 동안 다른 GUI 또는 CLI는 이 호스트에 클라이언트로 붙을 수 있습니다.
4. 처리 완료 후 활성 구독자가 없으면 CLI 호스트는 graceful shutdown 합니다.

협업 제어가 포함된 변경 흐름은 다음과 같습니다.

1. AI 에이전트가 특정 노드 작업 전 presence를 선언합니다.
2. GUI는 해당 노드에 작업 중 상태를 렌더링합니다.
3. AI는 현재 `base_version`을 읽고 mutation 또는 proposal을 생성합니다.
4. 호스트는 버전을 검사해 즉시 커밋 또는 conflict 응답을 결정합니다.
5. proposal인 경우 GUI는 ghost UI와 승인 액션을 노출합니다.
6. 승인 또는 거절 결과는 actor metadata와 함께 audit trail에 기록됩니다.

## 11. 엔지니어링 제약

- 시스템은 로컬 우선 구조를 유지해야 합니다.
- 일반적인 단일 머신 사용에서 네트워크 포트를 열지 않아야 합니다.
- 프로세스 경계 밖 통신은 항상 타입 계약을 가져야 합니다.
- 워크스페이스별 DB 소유권은 한 시점에 하나의 호스트만 가져야 합니다.
- GUI 단독 실행은 Houston 없이도 direct runtime으로 동작 가능해야 합니다.
- UI 렌더링 계층과 상태 변경 오케스트레이션은 분리되어야 합니다.
- Magam 앱은 모델 추론 요청을 직접 프록시하거나 자체 AI billing/auth gateway가 되어서는 안 됩니다.
- UI와 CLI는 infrastructure 세부사항이 아니라 공통 service/domain contract에만 의존해야 합니다.
- Houston은 business logic을 담는 계층이 아니라 선택 가능한 orchestration/transport 계층이어야 합니다.
- 프로세스 간 API는 느슨한 JSON payload가 아니라 Protobuf 계약을 기본값으로 사용해야 합니다.
- CLI가 우연히 장기 데몬이 되는 구조는 피하고, 명시적 정책 없는 백그라운드 상주 프로세스를 만들지 않아야 합니다.
- 모든 canonical write는 `actor`와 `base_version` 없이 수행되어서는 안 됩니다.
- proposal accept 경로 역시 일반 mutation과 동일한 충돌 검사를 다시 수행해야 합니다.
- presence는 heartbeat 또는 만료 정책 없이 무기한 남아 있어서는 안 됩니다.
- audit log는 비활성화 가능한 선택 기능이 아니라 기본 수집 항목이어야 합니다.

## 12. 확장 방향

- 낙관적 동시성 제어와 버전 레코드를 더 확장해 다중 오브젝트 단위의 트랜잭션 그룹을 지원
- DB 기반 변경 이력을 활용한 Undo/Redo 트레일 고도화
- 대규모 AI 레이아웃 변경을 즉시 반영하지 않고 승인 전 초안으로 보여주는 Ghost UI / Suggestion Mode 고도화
- actor 신뢰도, 변경 영향도, 승인 정책을 기반으로 한 반자동 협업 정책 계층 추가

## 13. 문서 상태

이 문서는 `product-vision.md`를 바탕으로 시작했고, 이후 멀티플레이어 협업 제어 요구사항을 포함한 PRD 보강 내용을 순차적으로 통합한 living technical spec입니다.
