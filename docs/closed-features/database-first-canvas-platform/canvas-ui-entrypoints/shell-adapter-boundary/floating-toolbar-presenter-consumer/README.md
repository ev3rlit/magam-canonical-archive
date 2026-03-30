# Floating Toolbar Presenter Consumer

## 개요

이 sub-task는 `FloatingToolbar.tsx`를 toolbar presenter consumer로 축소한 내용을 문서화한다.

핵심은 toolbar가 create/preset surface open/close policy, anchor 생성, derived state 계산을 직접 owner로 갖지 않고 `toolbarPresenter.ts`의 helper를 소비하도록 바뀐 점이다.

## 범위

- `app/processes/canvas-runtime/bindings/toolbarPresenter.ts`
- `app/components/FloatingToolbar.tsx`의 presenter adoption
- create/preset toggle policy
- derived toolbar presenter state 계산

## 비범위

- toolbar section inventory 자체 변경
- selection floating menu ownership handoff
- toolbar action routing bridge 확장

## 현재 역할

현재 `FloatingToolbar.tsx`는 다음을 직접 계산하지 않는다.

- active create label / preset label
- create menu open 여부
- preset menu open 여부
- create/preset trigger anchor 생성
- create/preset surface toggle 정책

이 계산은 `resolveToolbarPresenterState(...)`, `toggleToolbarCreateSurface(...)`, `toggleToolbarPresetSurface(...)`, `selectToolbarCreateMode(...)`, `selectToolbarPreset(...)` 같은 helper가 맡는다.

## 왜 분리하는가

toolbar의 presenter state와 surface toggle policy가 `FloatingToolbar.tsx`에 남아 있으면 `canvas-toolbar` feature가 presenter file을 계속 hot spot으로 건드리게 된다.

presenter consumer 경계의 목적은 다음과 같다.

- `FloatingToolbar.tsx`를 generic presenter로 축소
- toolbar feature lane이 presenter가 아니라 feature-owned model에 집중하게 만들기

## 완료 기준

- `FloatingToolbar.tsx`는 create/preset open/close 분기 owner가 아니다.
- presenter-derived state는 binding helper가 계산한다.
- toolbar surface policy 변경은 우선 `toolbarPresenter.ts`를 수정한다.

## 관련 문서

- `./implementation-plan.md`
- `./tasks.md`
- `../README.md`
- `../implementation-plan.md`
