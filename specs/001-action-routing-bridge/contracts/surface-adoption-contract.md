# Contract: Surface Adoption

## 목적

네 UI surface를 bridge 경로로 순차 전환할 때 책임 경계를 일관되게 유지한다.

## Adoption Order

1. `toolbar`
2. `selection-floating-menu`
3. `pane-context-menu`
4. `node-context-menu`

## Rules

1. 각 surface는 bridge 호출 전용 adapter만 소유한다.
2. 각 전환 단계에서 해당 surface의 direct mutation/query 호출을 제거한다.
3. 전환 단계별로 미등록 intent, invalid payload, rollback 경로 회귀 테스트를 포함한다.
4. 전환되지 않은 surface에 bridge와 직접 호출 경로를 동시에 도입하면 안 된다.
5. 전환 완료 기준은 네 surface 모두 bridge 단일 경로를 사용하는 상태다.

## Verification Matrix

| Surface | Required Check |
|---------|----------------|
| `toolbar` | create/update intent가 bridge 경로만 사용 |
| `selection-floating-menu` | style/content intent gating + normalization 일관성 |
| `pane-context-menu` | pane 기반 create intent ordered dispatch 사용 |
| `node-context-menu` | node-target intent가 direct write path 없이 bridge 경유 |
