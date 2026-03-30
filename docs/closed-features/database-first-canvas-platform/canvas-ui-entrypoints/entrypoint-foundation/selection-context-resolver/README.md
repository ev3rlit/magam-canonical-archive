# Selection Context Resolver

## 개요

이 sub-slice는 선택 상태와 대상 node 문맥을 공통 shape로 해석한다.

## 범위

- selection snapshot
- target node resolution
- canonical metadata lookup
- relation context lookup
- multi-selection homogeneity 판단
- floating anchor basis 산출

## 비범위

- overlay rendering
- mutation execution
- 개별 menu item 구성

## 완료 기준

- toolbar, floating menu, node menu가 같은 selection context를 읽는다.
