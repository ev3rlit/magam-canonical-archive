# R2-P0 Plugin Runtime Productization Minimum

## 개요

plugin runtime v1을 1.0에서 쓸 수 있는 최소 제품 수준으로 끌어올린다. 우선 chart/table 중심으로 다룬다.

## 왜 이 마일스톤인가

R2에서는 object-local block body와 independent widget의 경계를 실제 제품에서 보여줘야 한다. plugin minimum은 그 독립 위젯 경로를 닫는다.

## 범위

- chart widget
- table widget
- fallback diagnostics
- productized example path

## 비범위

- plugin marketplace
- arbitrary trusted code direct mount
- 고급 capability grant 운영

## 핵심 결정 / 계약

- plugin은 canonical schema를 대체하지 않는다.
- object 내부 작은 시각 요소는 content block으로, 독립 위젯은 plugin instance로 다룬다.
- provider proxy와 무관하게 sandbox/capability gate를 유지한다.

## 의존성

- `docs/features/database-first-canvas-platform/plugin-runtime-v1/README.md`
- `../R2-P1-composable-block-body-v2/README.md`

## 완료 기준

- 최소 2종 widget이 production 수준으로 동작한다.
- fallback diagnostics가 사용자에게 보인다.
- object-local block과 independent widget의 경계가 문서/UX에서 명확하다.
