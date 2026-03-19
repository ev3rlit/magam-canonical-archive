# R3-P1 Realtime Pilot for Shared Document

## 개요

shared document를 대상으로 realtime 협업 pilot을 검증한다. 제품 전체 기본값이 아니라 제한된 실험 경로로 둔다.

## 왜 이 마일스톤인가

realtime collaboration은 validated demand 이후에만 확대하는 것이 roadmap 원칙이므로, pilot 형태로 분리한다.

## 범위

- shared document pilot
- limited realtime sync path
- pilot 운영 기준 문서화

## 비범위

- 전체 제품 기본값 전환
- Excalidraw 수준 full realtime feature parity
- file-first truth 복귀

## 핵심 결정 / 계약

- realtime은 1.0을 막는 선행조건이 아니다.
- pilot이어도 canonical DB truth와 revision backbone은 유지한다.
- in-app AI chat/session은 계속 없다.

## 의존성

- `R3-P1-presence-lite/README.md`

## 완료 기준

- shared document 대상 pilot scope가 정의된다.
- realtime path의 성공/실패 조건이 문서화된다.
- 1.0 주 경로와 분리된 실험으로 남는다.
