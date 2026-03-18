# UI Runtime State

## 개요

이 sub-slice는 session 중에만 존재하는 UI state를 정리한다.

## 범위

- active tool
- open overlay state
- floating menu anchor
- hover state
- optimistic pending state

## 비범위

- persisted canvas/document/object state
- action schema
- selection metadata 해석 자체

## 완료 기준

- persisted state와 runtime-only state의 경계가 섞이지 않는다.

## 관련 문서

- `./implementation-plan.md`
- `../README.md`
- `../../README.md`
- `../../../implementation-plan.md`
