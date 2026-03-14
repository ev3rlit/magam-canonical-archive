# Agent Evaluation Workflow

이 문서는 `agent-evaluator`를 사용해 Codex agent를 체계적으로 평가하고 점진적으로 개선하는 운영 방법을 정리한다.

관련 파일:
- agent 정의: `.codex/agents/agent-evaluator.toml`
- 평가 리포트 템플릿: `.codex/templates/agent-evaluation-report.md`

## 목적

`agent-evaluator`는 단순 리뷰어가 아니다.
이 에이전트는 아래 역할을 함께 수행한다.

1. 대상 agent의 실제 실행 결과를 평가한다.
2. human feedback을 증거와 함께 반영한다.
3. 작은 prompt 변경안을 제안한다.
4. 필요하면 prompt를 직접 수정한다.
5. 같은 입력으로 다시 실행해 baseline 대비 개선 여부를 확인한다.

핵심 원칙:
- 한 번에 하나의 agent만 평가한다.
- 한 번에 하나의 작은 변경만 실험한다.
- 같은 task/input으로 baseline과 variant를 비교한다.
- human feedback은 중요하지만, 항상 실행 증거와 함께 본다.

## 언제 사용하는가

다음 상황에서 `agent-evaluator`를 사용한다.

- `feature-prd-writer`가 README를 과도하게 갈아엎는다.
- `feature-prd-writer`가 `ready_for_specify`를 자주 잘못 판단한다.
- `speckit-master`가 clarify를 너무 자주 돌리거나 거의 안 돌린다.
- `speckit-master`가 기존 artifact가 있는데도 매번 처음부터 재생성한다.
- 어떤 agent가 결과는 내지만 사람이 후처리에 시간을 많이 쓴다.
- human feedback이 누적되었고, 다음 프롬프트 수정을 정당화할 근거가 필요하다.

## 평가 단위

평가는 아래 셋 중 하나를 대상으로 한다.

1. 단일 run
2. 특정 prompt 버전
3. baseline vs variant 비교

가장 권장하는 형태는 `baseline vs variant 비교`다.

## 입력 묶음

`agent-evaluator`에 넘길 때는 가능하면 아래 증거를 같이 준다.

- 대상 agent 설정 파일
- task brief 또는 기대 결과
- 실제 입력 텍스트 또는 입력 파일 경로
- 실행 transcript 또는 요약 로그
- 생성된 산출물
- 이전 평가 리포트
- human feedback 메모

human feedback 예시:
- "README 구조는 좋아졌는데 non-goal이 자꾸 빠진다"
- "clarify를 너무 빨리 호출해서 흐름이 끊긴다"
- "결과는 맞는데 artifact를 불필요하게 다시 만든다"

## 표준 평가 루프

### 1. 평가 대상 고정

- 대상 agent 하나를 고른다.
- 대표 task 또는 고정 입력 세트를 정한다.
- 성공 조건을 먼저 적는다.

예:
- 대상: `feature-prd-writer`
- 고정 입력: 모호한 feature idea 3개, README path 3개, feature dir 2개
- 성공 조건: `ready_for_specify` 정확도, human fix time 감소

### 2. Baseline 실행

- 현재 prompt 그대로 대상 agent를 실행한다.
- 결과 artifact와 transcript를 남긴다.
- 사람이 후처리에 얼마나 시간을 썼는지 기록한다.

### 3. Human Feedback 수집

human feedback은 자유 텍스트로 받아도 되지만, 아래 항목으로 정리하는 것이 좋다.

- 좋았던 점
- 불편했던 점
- 혼란스러웠던 점
- 다음 수정에서 꼭 바뀌어야 할 점

### 4. `agent-evaluator`로 채점

`agent-evaluator`는 최소 아래 항목을 점수화한다.

- `input_handling`
- `instruction_following`
- `workflow_judgment`
- `output_quality`
- `handoff_or_readiness_quality`
- `human_feedback_alignment`

점수는 1~5를 사용한다.

### 5. 한 가지 변경만 선택

평가 결과를 보고 가장 작은 변경 하나만 선택한다.

좋은 예:
- 입력 정규화 규칙 2줄 추가
- clarify trigger 조건 1개 명확화
- final output contract에 readiness 필드 1개 추가

나쁜 예:
- agent 전체 프롬프트를 대규모로 다시 작성
- 입력 규칙, 출력 계약, boundary rules를 한 번에 다 변경

### 6. Variant 적용

- 요청이 있으면 `agent-evaluator`가 prompt를 직접 수정할 수 있다.
- 수정한 경우 어떤 문장이 어떻게 바뀌었는지 반드시 기록한다.

### 7. 같은 입력으로 재실행

- baseline과 같은 task/input으로 다시 실행한다.
- 다른 입력으로 재평가하면 비교 의미가 약해진다.

### 8. 비교 및 결정

다음을 기준으로 유지 여부를 판단한다.

- overall score 상승
- 핵심 카테고리 점수 상승
- human feedback 개선
- regression risk 허용 가능

점수가 비슷해도 human fix time이 줄었다면 유지할 가치가 있다.

## Human Feedback 반영 규칙

human feedback은 반드시 아래처럼 분리한다.

1. 직접 관찰
2. 실행 증거로 확인된 내용
3. 아직 증거가 부족한 추정

예:
- 직접 관찰: "clarify가 너무 자주 떠서 흐름이 끊긴다"
- 증거 확인: 실제 5개 중 4개 케이스에서 clarify 실행
- 추정: clarify threshold가 너무 낮을 가능성

이 분리를 안 하면, 기분에 따라 프롬프트가 흔들린다.

## 권장 리포트 보관 위치

평가 결과는 아래 위치에 누적 보관하는 것을 권장한다.

- `docs/reports/agent-evals/YYYYMMDD-agent-name-baseline.md`
- `docs/reports/agent-evals/YYYYMMDD-agent-name-variant-a.md`
- `docs/reports/agent-evals/YYYYMMDD-agent-name-comparison.md`

리포트 형식은 `.codex/templates/agent-evaluation-report.md`를 사용한다.

## 권장 운영 메트릭

처음에는 아래만 추적해도 충분하다.

- overall score
- `human_feedback_alignment`
- human fix time
- false ready rate
- unnecessary clarify rate

agent별 예시:

### `feature-prd-writer`

- `ready_for_specify` 정확도
- PRD completeness
- rewrite intrusiveness
- human fix time

### `speckit-master`

- source resolution 정확도
- resume correctness
- clarify decision 정확도
- implementation readiness precision

## 운영 팁

- 평가용 입력 세트는 고정해라.
- prompt 변경은 한 번에 하나만 넣어라.
- 증거 없는 불만은 보류하되, 기록은 남겨라.
- 점수보다 `왜` 점수가 바뀌었는지가 더 중요하다.
- baseline 없이 variant만 보면 개선인지 판단하기 어렵다.

## 최소 운영 절차

시간이 부족하면 아래 순서만 지켜도 된다.

1. 대상 agent 선택
2. baseline run 저장
3. human feedback 3줄 기록
4. `agent-evaluator`로 리포트 작성
5. 작은 prompt 수정 1개
6. 같은 입력으로 재실행
7. 비교 리포트 저장
