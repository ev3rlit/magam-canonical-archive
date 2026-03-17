---
title: ADR-0005 Database-First Canvas Platform
date: 2026-03-16
status: accepted
authors:
  - platform-team
tags:
  - adr
  - architecture
  - storage
  - database
  - canvas
  - plugin-runtime
aliases:
  - Database-First Canvas ADR
  - DB-first canvas ADR
  - 데이터베이스 기반 캔버스 플랫폼 ADR
---

# ADR-0005: Adopt Database-First Canvas Platform

## Context

Magam의 현재 핵심 워크플로우는 `.tsx` file-first 구조다.

- `.tsx` 파일이 문서의 source of truth다.
- AI는 파일 시스템에서 코드를 직접 읽고 수정할 수 있다.
- React 컴포넌트 기반 조합으로 높은 표현력을 얻는다.

이 방식은 코드 중심 authoring에는 강하지만, 우리가 다음 단계에서 만들려는 제품 요구와는 점점 맞지 않기 시작했다.

우리가 풀어야 하는 핵심 문제는 다음과 같다.

### 1. UI 기반 직접 편집의 한계

사용자 레벨에서 자연스러운 direct manipulation을 제공하려면 오브젝트 추가, 수정, 위치 변경, 정렬, 구조 변경을 UI에서 즉시 반영할 수 있어야 한다.

하지만 `.tsx`를 canonical artifact로 유지하면 이런 편집은 결국 AST patch 또는 코드 생성 문제로 환원된다. 이는 다음 요구와 긴장 관계를 만든다.

- 코드 구조를 모르는 사용자도 편집 가능한 UX
- 캔버스 상태를 우선하는 인터랙션
- 구조 변경이 잦은 large board editing

### 2. AI 이점은 file-first에만 묶여 있지 않다

`.tsx` file-first의 큰 장점 중 하나는 AI가 raw file을 빠르게 읽고 수정할 수 있다는 점이다.

하지만 이 장점은 tool contract로 상당 부분 대체 가능하다.

- CLI/MCP 기반 query
- 부분 문서 조회
- 도메인 단위 mutation
- workspace 단위 탐색

즉, AI 친화성을 유지하려면 반드시 file-first를 canonical path로 유지해야 하는 것은 아니다.

### 3. Workspace와 문서 규모가 커질수록 file-first 비용이 커진다

단일 `.tsx` 파일 또는 파일 중심 문서 구조는 규모가 커질수록 다음 비용을 만든다.

- 하나의 파일이 지나치게 커짐
- 변경 충돌 가능성 증가
- workspace 차원의 검색/분류/참조 관리 어려움
- 부분 읽기/부분 수정 locality 부족

### 4. 제품 방향이 plugin-capable canvas runtime으로 확장되고 있다

우리는 native node만이 아니라 다음을 canvas에 올릴 수 있어야 한다.

- 외부 그래프/차트 라이브러리
- 테이블, 캘린더 같은 사용자 커스텀 요소
- TypeScript 기반 plugin/component

이 요구는 “문서 = 코드 파일” 모델보다 “문서 + canonical data + runtime asset” 모델에 더 잘 맞는다.

## Decision Drivers

- direct manipulation 중심 UX를 기본 경로로 삼을 것
- 대형 workspace와 large document를 안정적으로 관리할 것
- query/search/embedding을 canonical data 계층에서 다룰 것
- plugin/component 확장을 허용할 것
- AI 편집은 raw file overwrite보다 tool-driven mutation을 우선할 것

## Decision

Magam은 `.tsx` file-first를 canonical editing path로 유지하지 않고, **database-first canvas platform**으로 전환한다.

구체적으로는 다음을 채택한다.

1. 데이터베이스를 workspace와 문서의 primary source of truth로 사용한다.
2. canonical model과 canvas composition을 분리한다.
3. 사용자 커스텀 요소와 외부 라이브러리는 plugin/component runtime 경로로 수용한다.
4. AI는 raw file edit보다 CLI/MCP/tool contract 기반 조회/수정을 우선 사용한다.
5. `.tsx`는 필요 시 import/reference 경로로 남길 수 있으나, 더 이상 canonical editable artifact가 아니다.

## Decision Details

### 저장 책임 분리

- `workspace database`
  - 문서, object graph, metadata, search/embedding index, plugin registry를 저장한다.
- `canonical model`
  - 의미 데이터와 관계 데이터의 진실을 담당한다.
- `canvas composition`
  - 배치, 인스턴스, binding, view state를 담당한다.
- `plugin runtime`
  - chart/table/calendar/custom component 같은 실행 가능한 시각화 자산을 담당한다.

### AI 경로 전환

file-first의 장점이었던 “AI가 파일을 직접 고치기 쉽다”는 점은 인정한다.

그러나 앞으로는 다음 경로를 더 중요한 인터페이스로 본다.

- document/object query
- partial mutation
- workspace-aware search
- plugin instance manipulation

즉, AI 친화성의 중심을 file edit에서 tool contract로 옮긴다.

### TSX의 역할 재정의

TypeScript/TSX 기반 컴포넌트를 완전히 버리지는 않는다.

대신 역할을 바꾼다.

- 이전: 문서 그 자체
- 이후: plugin/component asset 또는 import 대상

이 결정으로 TSX는 표현력과 확장성은 유지하되, canonical storage 책임에서는 내려온다.

## Alternatives Considered

### A. `.tsx` file-first 유지

- 장점: 명시적이고 inspectable하며 AI가 직접 수정하기 쉽다.
- 단점: UI 기반 direct manipulation, workspace 관리, large file 문제를 구조적으로 해결하지 못한다.
- 결론: 비채택

### B. file-first를 유지하되 shard/file 수를 늘려 해결

- 장점: 텍스트 파일 inspectability와 Git diff 친화성을 일부 유지할 수 있다.
- 단점: canonical storage가 여전히 파일 기반이면 direct manipulation과 query locality 문제를 근본적으로 해결하지 못한다.
- 결론: 비채택

### C. database-first + raw TSX document execution

- 장점: 자유로운 TS/TSX 표현력을 가장 빠르게 확보할 수 있다.
- 단점: 문서와 실행 코드를 과도하게 결합하고, plugin/security/runtime/versioning 부담이 커진다.
- 결론: 기본 경로로는 비채택

### D. database-first + canonical model + plugin runtime (Selected)

- 장점: UI 편집, workspace 확장성, search/embedding, plugin 확장을 함께 수용할 수 있다.
- 단점: tooling, migration, runtime boundary 설계가 더 중요해진다.
- 결론: 최종 채택

## Consequences

### Positive

- direct manipulation 중심 UX를 canonical path로 설계할 수 있다.
- workspace, 문서, 검색, embedding을 같은 데이터 계층에서 다룰 수 있다.
- giant `.tsx` file 문제를 구조적으로 줄일 수 있다.
- plugin/component 기반의 외부 시각화 확장 경로를 자연스럽게 열 수 있다.
- AI는 파일 전체 overwrite 대신 부분 조회/부분 수정 도구를 사용할 수 있다.

### Negative

- raw file inspectability와 text diff 친화성은 일부 약해진다.
- AI/CLI/tooling 계약이 제품 핵심 인프라가 된다.
- canonical schema, migration, backup/export 전략이 더 중요해진다.
- plugin runtime과 capability/sandbox 설계 부담이 커진다.

## Follow-up

1. canonical model, canvas composition, plugin registry의 최소 schema를 정의한다.
2. AI/CLI/MCP가 사용하는 tool contract를 설계한다.
3. plugin manifest, capability, host API를 문서화한다.
4. 기존 `.tsx` 자산의 import/migration tooling은 별도 feature로 분리해 설계한다.
5. PostgreSQL-compatible storage target과 local/embedded 운영 모델을 구체화한다.
