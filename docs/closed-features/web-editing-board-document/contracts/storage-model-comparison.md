# Comparison: Single DB File vs Sharded JSON Files

## 목적

웹 편집 canonical storage를 결정하기 전에 `단일 DB 파일`과 `sharded JSON files`의 장단점을 비교하고, 어떤 조건에서 어느 쪽이 더 적합한지 선택 기준을 남긴다.

이 문서는 최종 결정을 내리는 문서가 아니라, 현재까지 논의된 우선순위를 비교표로 정리한 참고 계약이다.

## 비교 전제

- `단일 DB 파일`은 로컬 앱이 직접 열 수 있는 single-file embedded document DB를 뜻한다
- `sharded JSON files`는 하나의 논리 문서를 여러 JSON shard로 분리해 저장하는 방식을 뜻한다
- 사용자는 주로 웹 기반 에디터와 AI 앱 채팅으로 문서를 편집한다
- AI가 무엇을 직접 읽고 수정하는지가 storage 선택에서 가장 중요한 변수다

## 비교표

| 항목 | 단일 DB 파일 | Sharded JSON files | 상대 우위 |
|------|--------------|--------------------|-----------|
| 사용자 UX | 문서 1개처럼 보이기 쉽다 | 내부 shard를 감춰야 한다 | 단일 DB 파일 |
| 공유/백업 | 단일 파일 복사 또는 업로드로 끝난다 | 폴더 패키지 또는 bundle export가 필요하다 | 단일 DB 파일 |
| AI가 raw artifact를 직접 읽고 수정 | 불리하다 | 매우 유리하다 | Sharded JSON files |
| AI가 MCP/tool contract로 부분 조회/부분 수정 | 매우 유리하다 | 유리하다 | 단일 DB 파일 |
| 부분 조회/부분 업데이트 locality | query 단위로 매우 좋다 | shard 설계가 좋으면 좋다 | 단일 DB 파일 |
| 토큰 효율 | 고수준 query contract가 있으면 매우 좋다 | 필요한 shard만 읽으면 좋다 | 상황 의존 |
| Git diff / PR review | 불리하다 | 유리하다 | Sharded JSON files |
| 수동 디버깅과 inspection | 전용 툴 의존 | 텍스트 파일 inspection이 쉽다 | Sharded JSON files |
| schema migration | 중앙 집중 migration에 유리하다 | 파일별 migration orchestration이 필요하다 | 단일 DB 파일 |
| 검색/인덱싱 | 매우 강하다 | 별도 인덱싱 계층이 필요하다 | 단일 DB 파일 |
| adapter/plugin payload 저장 | registry와 함께 다루기 쉽다 | 가능하지만 분산 관리가 필요하다 | 단일 DB 파일 |
| 손상 복구 국소성 | DB 손상 시 단일 artifact 영향이 클 수 있다 | 일부 shard 손상은 국소적일 수 있다 | Sharded JSON files |
| 제품 내부 구현 난이도 | 앱/MCP/tooling 설계가 중요하다 | manifest/shard packaging 설계가 중요하다 | 상황 의존 |

## 선택 기준

### 단일 DB 파일이 더 적합한 경우

- 사용자에게 Excalidraw처럼 문서 1개 UX를 주는 것이 매우 중요하다
- AI가 raw file edit보다 앱/MCP가 제공하는 도메인 툴을 통해 작업해도 괜찮다
- 부분 조회, 검색, reparent, ordering, undo/redo, provenance 관리가 핵심이다
- 내부 shard를 사용자에게 감추는 것보다, 단일 artifact 관리가 중요하다

### Sharded JSON files가 더 적합한 경우

- AI 앱이 워크스페이스 파일을 직접 읽고 수정하는 흐름을 최우선으로 유지해야 한다
- Git diff, code review, text-level inspectability가 중요하다
- 앱 바깥에서도 문서 일부를 직접 열어보고 patch할 가능성을 열어 두고 싶다
- MCP/tooling이 없어도 AI가 canonical artifact를 직접 수정할 수 있어야 한다

## 현재 논의 기준에서의 시사점

- 제품 UX만 보면 단일 DB 파일이 더 자연스러울 수 있다
- AI가 기존처럼 워크스페이스 파일을 직접 읽고 수정해야 한다면 sharded JSON files가 더 자연스럽다
- 따라서 `문제는 DB냐 파일이냐보다 AI가 어떤 인터페이스로 접근하느냐`라는 판단을 유지한다

## 아직 열려 있는 결정

- AI 편집의 기본 경로를 file editing으로 둘지, MCP/tool editing으로 둘지
- canonical artifact를 사람이 inspect 가능한 텍스트로 유지할 필요가 있는지
- 공유/백업/동기화 흐름에서 “문서 1개” 경험을 어느 정도까지 강제할지

## Out of Scope

- 특정 데이터베이스 엔진 최종 선택
- package/export bundle 세부 포맷
- storage encryption / sync transport 세부 구현
