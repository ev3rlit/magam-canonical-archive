# R2-P0 Share and Review Links

## 개요

read-only 링크와 review 링크를 제공해 외부 이해관계자와 문서를 공유하고 검토받을 수 있게 한다.

## 왜 이 마일스톤인가

1.0에서는 내부 authoring뿐 아니라 외부 review 흐름도 닫혀야 한다. share/review link는 proposal 기반 운영과 잘 맞는 배포 surface다.

## 범위

- read-only 링크
- review 링크
- proposal/revision과 연결된 review 진입

## 비범위

- 공개 marketplace
- anonymous real-time collaboration
- provider proxy

## 핵심 결정 / 계약

- share는 projection이지만 truth는 canonical DB에 남는다.
- review link는 proposal/approval 흐름과 연결된다.
- 앱 내부 AI chat 없이도 외부 의견 수렴이 가능해야 한다.

## 의존성

- `R2-P0-revision-and-approval-backbone-hardening/README.md`

## 완료 기준

- read-only와 review 링크를 분리해 제공할 수 있다.
- review 링크가 approval/revision 흐름과 연결된다.
- canonical truth와 공유 projection의 경계가 유지된다.
