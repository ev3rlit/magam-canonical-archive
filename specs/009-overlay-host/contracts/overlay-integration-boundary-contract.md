# Contract: Overlay Integration Boundary

## 목적

overlay host와 인접 foundation slice, 기존 UI runtime 경계 간 책임 분리를 명확히 한다.

## Owned by Overlay Host

- overlay lifecycle (`open`, `close`, `replace`)
- positioning shell (anchor -> resolved position)
- stacking/layer ordering
- outside/Escape dismiss wiring
- focus open/restore lifecycle

## Not Owned by Overlay Host

- selection 해석 (`selection-context-resolver`)
- action routing/mutation dispatch (`action-routing-bridge`)
- runtime UI business state (`ui-runtime-state`)
- surface별 action expose 및 enable/disable 정책
- canvas 외부 global dialog/search/tab menu 체계

## Integration Rules

1. surface는 host slot contribution을 등록하고 portal/listener를 직접 중복 소유하지 않는다.
2. pane/node menu item 계산은 기존 menu adapter 계층에서 계속 소유한다.
3. host는 action gating 결정을 하지 않고, 입력된 availability만 표시 계층에 반영한다.
4. canvas 외부 overlay는 host에 흡수하지 않는다.
5. 기존 `ContextMenu` 동작은 host primitive로 흡수하되 기능 동등성을 유지한다.

## Failure Contract

- boundary violation (host doing gating): `OVERLAY_BOUNDARY_VIOLATION`
- duplicate portal/listener ownership: `OVERLAY_OWNERSHIP_DUPLICATED`
- cross-scope takeover (global overlay): `OVERLAY_SCOPE_VIOLATION`
