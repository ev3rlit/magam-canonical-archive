# Action Routing Bridge

## 개요

이 sub-slice는 UI intent를 canonical mutation/query action contract로 연결한다.

## 범위

- UI intent -> domain action mapping
- action payload normalization
- command dispatch contract
- optimistic/rollback 연결 포인트

## 비범위

- canonical mutation schema 자체 정의
- selection 해석
- overlay 위치 계산

## 완료 기준

- 모든 UI entrypoint가 ad-hoc write path 없이 같은 action bridge를 사용한다.
