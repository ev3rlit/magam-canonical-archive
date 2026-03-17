# Overlay Host

## 개요

이 sub-slice는 canvas overlay의 공통 host를 담당한다.

## 범위

- overlay stacking
- portal layering
- positioning shell
- outside click / escape dismiss
- focus lifecycle

## 비범위

- selection 해석
- mutation dispatch
- surface별 버튼/메뉴 구성

## 완료 기준

- toolbar, floating menu, pane menu, node menu가 같은 overlay host 규칙을 재사용한다.
