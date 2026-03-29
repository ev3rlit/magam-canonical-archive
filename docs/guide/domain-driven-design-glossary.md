# Domain-Driven Design Glossary

작성일: 2026-03-26  
목적: 이 저장소에서 반복해서 나오는 DDD 주요 용어를 빠르게 참고하기 위한 가이드

## 1. 어떻게 읽으면 좋은가

- 먼저 `Ubiquitous Language`, `Bounded Context`, `Aggregate`, `Entity`, `Value Object`를 읽는다.
- 그 다음 `Command`, `Domain Event`, `Projection`, `Published Language`를 읽는다.
- 마지막으로 `ACL`, `Repository`, `Invariant`, `Core Domain`을 읽는다.

이 저장소 문맥 예시는 주로 `docs/features/m2/canvas-runtime-contract/` 기준이다.

## 2. 핵심 용어

### Ubiquitous Language

한줄 설명:

- 개발자와 도메인 이해관계자가 같은 의미로 쓰는 공용 언어다.

이 저장소 예시:

- `Canvas`
- `CanvasNode`
- `Canonical Object`
- `Projection`
- `Mutation`

핵심 포인트:

- 문서, 대화, 코드 이름이 같은 뜻을 가져야 한다.
- 이름이 어색하면 모델이 어색한 경우가 많다.

### Bounded Context

한줄 설명:

- 특정 도메인 모델과 용어가 일관되게 유지되는 경계다.

이 저장소 예시:

- `Canvas Runtime`는 하나의 bounded context로 보고 있다.

핵심 포인트:

- bounded context는 마이크로서비스와 동일하지 않다.
- 경계 바깥에서는 같은 단어가 다른 의미를 가질 수 있다.

### Context Map

한줄 설명:

- bounded context들 사이의 관계를 나타낸 지도다.

이 저장소 예시:

- `Canvas Runtime` <- UI / CLI / MCP
- `Canvas Runtime` -> `Canonical Persistence`

핵심 포인트:

- 어떤 쪽이 upstream/downstream인지
- 어떤 번역 방식으로 연결하는지
- published language나 ACL이 어디 있는지 드러낸다.

### Aggregate

한줄 설명:

- 일관성을 강하게 보장해야 하는 작은 도메인 경계다.

이 저장소 예시:

- `Canvas Aggregate`
- `Canonical Object Aggregate`

핵심 포인트:

- aggregate는 작을수록 좋다.
- 즉시 일관성은 aggregate 내부에서만 보장한다.

### Aggregate Root

한줄 설명:

- aggregate 바깥에서 접근할 수 있는 유일한 대표 엔티티다.

이 저장소 예시:

- `Canvas Aggregate`의 root는 `Canvas`
- `Canonical Object Aggregate`의 root는 `Canonical Object`

핵심 포인트:

- 외부는 root를 통해서만 aggregate를 바꿔야 한다.
- 내부 멤버를 직접 참조하면 경계가 무너진다.

### Entity

한줄 설명:

- 속성이 바뀌어도 같은 것으로 추적되는 식별 가능한 도메인 대상이다.

이 저장소 예시:

- `Canvas`
- `CanvasNode`
- `Canonical Object`

핵심 포인트:

- identity가 중요하다.
- 값이 바뀌어도 같은 entity일 수 있다.

### Value Object

한줄 설명:

- identity보다 값 자체가 중요한 불변 개념 단위다.

이 저장소 예시:

- `Transform`
- `PresentationStyle`
- `RenderProfile`
- `MindmapMembership`

핵심 포인트:

- 가능하면 immutable하게 다루는 것이 좋다.
- 대부분의 세부 속성 묶음은 entity보다 value object가 더 잘 맞는다.

### Invariant

한줄 설명:

- 항상 참이어야 하는 도메인 규칙이다.

이 저장소 예시:

- node parent-child topology는 유효해야 한다.
- body block reorder 후 순서는 일관되어야 한다.
- revision precondition이 맞지 않으면 write를 허용하지 않는다.

핵심 포인트:

- invariant는 aggregate가 지키는 이유다.
- invariant가 서로 다른 대상에 걸치면 aggregate 경계를 다시 봐야 한다.

### Command

한줄 설명:

- 상태를 바꾸고 싶은 의도를 표현하는 요청이다.

이 저장소 예시:

- `canvas.node.move`
- `object.content.update`
- `object.body.block.reorder`

핵심 포인트:

- command는 아직 결과가 아니다.
- 보통 명령형 의도다.

### Mutation

한줄 설명:

- 실제 상태를 바꾸는 write 작업 또는 그 실행 단위다.

이 저장소 예시:

- mutation batch 1건
- undo/redo의 기준이 되는 semantic transaction

핵심 포인트:

- command는 의도
- mutation은 실행된 write 작업

### Domain Event

한줄 설명:

- 도메인에서 이미 일어난 사실을 나타내는 과거형 이벤트다.

이 저장소 예시:

- `CanvasNodeMoved`
- `ObjectBodyBlockReordered`

핵심 포인트:

- 이름은 과거형이 좋다.
- 이벤트는 "무슨 일이 일어났는가"를 말한다.

### Integration Event

한줄 설명:

- 다른 컨텍스트나 외부 소비자가 알아야 하는 변화 사실을 전달하는 이벤트다.

이 저장소 예시:

- `CanvasChanged`

핵심 포인트:

- domain event와 같을 수도 있지만, 항상 같은 것은 아니다.
- 외부에 공개되는 시점에서 published language 일부가 될 수 있다.

### Policy

한줄 설명:

- command를 허용/거절하거나 후속 동작을 결정하는 규칙 묶음이다.

이 저장소 예시:

- `ValidateRevisionPrecondition`
- `EnforceMindmapTopology`
- `EnforceBodyBlockOrdering`

핵심 포인트:

- 여러 aggregate에 걸친 판단이나 orchestration 규칙을 담기 좋다.

### Projection

한줄 설명:

- consumer가 읽기 좋게 재구성한 read-side 표현이다.

이 저장소 예시:

- `Hierarchy Projection`
- `Render Projection`
- `Editing Projection`

핵심 포인트:

- projection은 write 규칙을 소유하지 않는다.
- 누가 읽는지에 따라 분리될 수 있다.

### Published Language

한줄 설명:

- bounded context가 바깥과 소통할 때 공개하는 표준 계약 언어다.

이 저장소 예시:

- command vocabulary
- projection contracts
- mutation result envelope
- dry-run / conflict semantics

핵심 포인트:

- 내부 구현 모델과 구분된다.
- UI/CLI/MCP가 믿고 쓸 수 있는 공용 contract다.

### Anti-Corruption Layer (ACL)

한줄 설명:

- 외부 모델이 내 도메인 언어를 오염시키지 않도록 막는 번역 계층이다.

이 저장소 예시:

- `Canvas Runtime`와 `Canonical Persistence` 사이의 repository translation 경계

핵심 포인트:

- raw DB row shape를 runtime model 안으로 직접 끌고 오지 않는다.
- 외부 언어를 내부 도메인 언어로 번역한다.

### Repository

한줄 설명:

- aggregate를 저장하고 다시 불러오는 추상화다.

이 저장소 예시:

- storage row를 `Canvas Aggregate`나 `Canonical Object Aggregate`로 재구성하는 계층

핵심 포인트:

- 도메인 모델은 persistence 세부 구현을 몰라야 한다.

### Factory

한줄 설명:

- 유효한 초기 상태를 가진 도메인 객체를 만들기 위한 생성 규칙이다.

이 저장소 예시:

- 새 `CanvasNode`를 생성하면서 필요한 기본 component/value object를 같이 조립하는 과정

핵심 포인트:

- 생성 규칙이 복잡하면 factory가 필요하다.

### Core Domain

한줄 설명:

- 제품의 차별화 포인트가 있는 핵심 도메인이다.

이 저장소 예시:

- `Canvas Runtime`

핵심 포인트:

- 가장 깊은 모델링과 가장 높은 설계 엄격성을 투자해야 한다.

### Supporting Subdomain

한줄 설명:

- 필요하지만 제품 차별화의 핵심은 아닌 하위 도메인이다.

이 저장소 예시:

- 향후 운영 보조 도구나 일부 문서화/automation 지원 기능

### Generic Subdomain

한줄 설명:

- 굳이 직접 차별화해서 만들 필요가 없는 범용 기능 영역이다.

이 저장소 예시:

- 인증, 일반 파일 저장, 보편적 외부 연동 인프라 같은 것들

## 3. 이 저장소에서 자주 헷갈리는 구분

### Canvas vs CanvasNode

- `Canvas`: 전체 편집 surface와 revision/invariant를 소유
- `CanvasNode`: canvas 위에 놓이는 배치/계층 단위

### CanvasNode vs Canonical Object

- `CanvasNode`: 어디에 어떻게 보이느냐
- `Canonical Object`: 무엇을 담고 있느냐

### Command vs Event

- `Command`: 바꾸고 싶다
- `Event`: 바뀌었다

### Mutation vs Projection

- `Mutation`: write
- `Projection`: read

### Domain Event vs Integration Event

- `Domain Event`: 내부 도메인 사실
- `Integration Event`: 외부 전달용 변화 사실

## 4. 추천 학습 순서

1. 이 문서
2. `docs/features/m2/canvas-runtime-contract/EVENT-STORMING.md`
3. `docs/features/m2/canvas-runtime-contract/BOUNDED-CONTEXT.md`
4. `docs/features/m2/canvas-runtime-contract/README.md`

## 5. 나중에 추가할 만한 용어

- Shared Kernel
- Customer-Supplier
- Conformist
- Separate Ways
- Partnership
- Specification
- Eventual Consistency
