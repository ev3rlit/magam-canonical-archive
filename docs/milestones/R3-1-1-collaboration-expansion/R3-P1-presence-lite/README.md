# R3-P1 Presence Lite

## 개요

1.0 이후 light presence와 follow 기초를 추가한다. realtime collaboration을 전면 도입하기 전에 최소한의 존재감 신호를 다룬다.

## 왜 이 마일스톤인가

presence는 중요하지만 1.0의 선행조건은 아니다. 따라서 collaboration 확장 마일스톤으로 분리한다.

## 범위

- presence indicator
- basic follow signal
- collaborator visibility 기초

## 비범위

- full realtime merge UX
- cursor storm handling
- enterprise collaboration suite

## 핵심 결정 / 계약

- canonical DB truth와 proposal/approval 모델은 유지한다.
- provider proxy와 in-app AI chat은 복귀하지 않는다.
- presence는 editing truth를 바꾸지 않는 보조 신호다.

## 의존성

- `../R3-P1-realtime-pilot-for-shared-document/README.md`

## 완료 기준

- light presence 신호를 표시할 수 있다.
- follow 기초가 문서화된다.
- 1.0 핵심 경로와 분리된 확장 기능으로 유지된다.
