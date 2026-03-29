# Canvas Runtime Contract TODO

이 파일은 `docs/features/m2/canvas-runtime-contract/README.md` 리뷰에서 나온 3개 쟁점을
하나씩 줄여 가기 위한 작업 목록이다.

기본 원칙:

- README의 선언 범위와 실제 산출물/성공 기준이 서로 같은 수준으로 닫혀야 한다.
- "있으면 된다"가 아니라 "무엇이 반드시 포함돼야 하는가"까지 적어야 한다.
- 후속 UI/CLI/CQRS 문서가 이 README만 보고도 같은 계약을 재사용할 수 있어야 한다.

## P1. Read Contract 범위 축소/명확화

문제:

- 현재 README는 read contract 범위를 넓게 선언한다.
- 하지만 실제 산출물과 성공 기준은 사실상 `canvas-hierarchy`만 잠그고 있다.
- 이 상태면 feature 완료 후에도 render/meta/read surface가 비어 있을 수 있다.

현재 결정:

- 공용 read side는 `hierarchy projection`, `render projection`, `editing projection`의 3분할로 고정한다.
- `hierarchy`는 구조 이해, `render`는 flat rendering, `editing`은 edit target/capability/anchor 해석을 담당한다.

결정할 것:

- 세 projection 사이의 필드 책임을 어디까지 분리할지 결정
  - `mindmap membership`을 hierarchy에 둘지, render에도 중복 노출할지
  - `object linkage`를 hierarchy/render/editing 중 어디까지 반복 노출할지
  - `selection/anchor metadata`를 editing 전용으로 둘지, render와 연결할 참조만 둘지
- projection 이름을 최종 확정할지 결정
  - `editing projection` 유지 여부
  - 필요하면 `interaction projection` 또는 다른 명칭으로 조정

README에 추가로 써야 할 것:

- "공용 read contract"의 최소 산출물 목록
- 각 산출물이 담당하는 책임과 비책임
- hierarchy contract만으로 충분한 경우와, 별도 render/meta contract가 필요한 경우
- `flat render view`와 `selection/anchor`가 후속 feature로 미뤄진다면
  이번 feature의 비목표 또는 후속 작업으로 명시

완료 조건 후보:

- 산출물 목록이 3.1의 선언 범위와 일치한다.
- 성공 기준이 hierarchy 외 read surface 포함 여부를 명시한다.
- 후속 CQRS/UI 문서가 어느 contract를 읽어야 하는지 README만으로 식별 가능하다.

작업 체크리스트:

- [x] 3.1의 최소 포함 요소를 "이번 feature에서 고정"과 "후속 feature로 이관"으로 분리
  - 이번 feature에서 필요한 모든 projection 계약을 고정하는 방향으로 결정함.
- [x] 7.1 산출물 목록에 read contract 파일 단위를 명시적으로 반영
- [x] 8. 성공 기준에 non-tree read surface 포함 여부를 반영
- [ ] 9. 관련 문서 또는 후속 작업 링크를 read contract 기준으로 재정렬

## P2. Write Result Contract의 성공 기준 강화

문제:

- 3.3은 write result contract의 최소 요소를 꽤 강하게 선언한다.
- 하지만 8장의 성공 기준은 envelope 존재 여부만 확인해서 요구사항이 약해진다.
- 이 상태면 retry, UI error mapping, diagnostics에 필요한 정보가 빠져도 성공으로 처리될 수 있다.

결정할 것:

- write result contract의 "must-have" 필드를 어디까지 강제할지 결정
- `warnings`, `structured error code`, `revision before/after`, `changed set` 외에
  `diagnostic metadata`, `rollback metadata`를 정말 v1 필수로 둘지 결정
- dry-run success와 real write success가 같은 envelope를 공유하되,
  어떤 차이만 허용할지 결정

README에 추가로 써야 할 것:

- 성공 기준에 들어갈 최소 필드 목록
- failure envelope의 필수 의미
  - validation failure
  - version conflict
  - retryable / non-retryable
- UI가 error mapping을 위해 기대하는 근거가 무엇인지
- CLI가 machine-readable consumer로서 기대하는 최소 diagnostics가 무엇인지

완료 조건 후보:

- 성공 기준이 "envelope가 있다"가 아니라 "필수 필드와 semantics가 있다"로 바뀐다.
- dry-run / real write / failure 각각의 최소 보장값이 적힌다.
- 후속 구현이 generic JSON wrapper로 축소되지 않도록 guardrail이 생긴다.

작업 체크리스트:

- [ ] 3.3의 최소 포함 요소를 MUST / OPTIONAL로 분리
- [ ] 8. 성공 기준에 write result 필수 필드와 failure semantics를 반영
- [ ] 3.4와 연결해서 dry-run/conflict 결과가 write result와 어떻게 맞물리는지 명시
- [ ] 필요하면 `structured error code` 예시 3~5개를 README에 추가

## P3. Dry-run / Conflict의 Schema 계약 보강

문제:

- README는 dry-run/conflict를 runtime 공용 계약으로 올린다.
- 그런데 산출물 목록에는 TypeScript 계약만 있고 JSON Schema는 없다.
- 그러면 다른 machine consumer가 같은 envelope를 검증 가능한 형태로 공유하기 어렵다.

결정할 것:

- dry-run / conflict를 별도 schema로 둘지,
  `canvas-write-result.schema.json` 안에 union 형태로 포함할지 결정
- conflict envelope와 generic failure envelope의 관계를 어떻게 둘지 결정
  - conflict가 failure envelope의 특수 케이스인지
  - 별도 top-level contract인지
- dry-run preview가 success envelope의 일부인지,
  별도 schema 변형인지 결정

README에 추가로 써야 할 것:

- schema source of truth 위치
- dry-run/conflict schema가 write result schema와 맺는 관계
- machine validation 대상이 되는 필드
  - revision precondition 관련 필드
  - expected/actual revision 또는 version
  - changed-set preview 존재 여부
  - retryable 여부

완료 조건 후보:

- dry-run/conflict도 다른 계약과 동일하게 schema 기반 검증이 가능하다.
- UI/CLI/MCP가 같은 JSON envelope shape를 공유한다고 말할 근거가 생긴다.
- 구현자가 TS 타입만 맞추고 wire format을 임의로 바꾸는 여지가 줄어든다.

작업 체크리스트:

- [ ] 7.1 산출물 목록에 dry-run/conflict 관련 schema 파일을 추가하거나,
      기존 write-result schema에 포함한다고 명시
- [ ] 3.4에 schema 관점의 contract boundary를 짧게 추가
- [ ] 8. 성공 기준에 "machine-validatable schema" 조건을 반영
- [ ] 13 또는 별도 섹션이 필요하면 contract 간 관계를 간단한 표/목록으로 정리

## 논의 순서 제안

- 1순위: P1
  - read contract 범위를 어디까지 잠글지 먼저 정해야 나머지 산출물 목록이 닫힌다.
- 2순위: P3
  - schema 경계를 정해야 dry-run/conflict를 어디에 두는지 안정된다.
- 3순위: P2
  - 마지막으로 성공 기준 문구를 위 결정에 맞춰 강화하면 된다.
