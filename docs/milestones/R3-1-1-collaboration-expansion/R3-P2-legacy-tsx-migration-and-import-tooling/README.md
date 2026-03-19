# R3-P2 Legacy TSX Migration and Import Tooling

## 개요

legacy `.tsx` 자산을 canonical DB 기반 문서로 가져오는 importer/migration 도구를 별도 후속 기능으로 다룬다.

## 왜 이 마일스톤인가

legacy TSX migration은 roadmap상 후속 기능이다. canonical DB truth와 1.0 주 경로를 흔들지 않기 위해 collaboration expansion 이후 backlog 성격으로 둔다.

## 범위

- legacy TSX importer
- migration provenance
- import policy
- re-import policy

## 비범위

- `.tsx` canonical truth 복귀
- file-first round-trip editing 재도입
- plugin runtime 대체

## 핵심 결정 / 계약

- `.tsx`는 canonical editable artifact가 아니다.
- migration은 import 경로이지 primary editing path가 아니다.
- block body와 plugin/widget 경계를 깨지 않는다.
- in-app AI chat/session 복귀와 무관하다.

## 의존성

- `docs/features/legacy-tsx-migration/README.md`

## 완료 기준

- importer 범위와 policy가 문서화된다.
- migration provenance를 남길 수 있다.
- canonical DB truth를 흔들지 않는 별도 기능으로 유지된다.
