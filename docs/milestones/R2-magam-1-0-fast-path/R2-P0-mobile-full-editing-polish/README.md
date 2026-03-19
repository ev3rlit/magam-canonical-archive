# R2-P0 Mobile Full Editing Polish

## 개요

mobile full editing shell을 1.0 수준으로 polish한다. 핵심은 gesture, toolbar, editing ergonomics, block body 편집 품질이다.

## 왜 이 마일스톤인가

mobile은 full editing을 지원한다는 제품 원칙을 R2에서 실제 품질로 증명해야 한다.

## 범위

- search/jump
- proposal inbox
- full editing ergonomics
- gesture / toolbar polish
- object-local block body 편집 polish

## 비범위

- mobile 전용 AI chat
- desktop parity 100%
- realtime multiplayer mobile UX

## 핵심 결정 / 계약

- mobile은 review-only shell이 아니다.
- AI 활용성은 external handoff가 보강하고, 편집 자체는 mobile native path로 지원한다.
- shape-local composable block body도 mobile에서 usable 해야 한다.

## 의존성

- `../../R1-external-agent-beta/R1-P0-mobile-full-editing-shell/README.md`
- `../../R1-external-agent-beta/R1-P1-composable-block-body-v1/README.md`

## 완료 기준

- mobile에서 full editing ergonomics가 1.0 수준으로 보인다.
- toolbar/gesture가 기본 편집 흐름을 막지 않는다.
- block body 편집이 mobile에서도 usable 하다.
