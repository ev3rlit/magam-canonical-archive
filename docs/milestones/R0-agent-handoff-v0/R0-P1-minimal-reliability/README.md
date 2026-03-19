# R0-P1 Minimal Reliability

## 개요

R0 usable path가 데모에 그치지 않도록 timeout, retry, offline 같은 최소 안정성 규칙을 넣는다.

## 왜 이 마일스톤인가

R0는 경로를 여는 버전이지만, 외부 host 기반 구조는 실패면이 바로 사용자 경험을 망친다. 최소 신뢰성은 같은 마일스톤에서 함께 닫아야 한다.

## 범위

- timeout
- retry 1회
- host offline 표시
- 실패 로그

## 비범위

- durable queue
- reconnect/resume 고도화
- multi-host failover

## 핵심 결정 / 계약

- external AI 입력 경로는 실패를 조용히 숨기지 않는다.
- provider proxy fallback은 두지 않는다.
- 실패는 host 상태와 proposal 상태에 명시적으로 드러난다.

## 의존성

- `../R0-P0-personal-agent-host/README.md`
- `../R0-P0-mobile-share-handoff/README.md`

## 완료 기준

- host timeout이 감지된다.
- 단일 retry가 수행된다.
- offline 상태가 사용자에게 보인다.
- 실패 로그가 남는다.
