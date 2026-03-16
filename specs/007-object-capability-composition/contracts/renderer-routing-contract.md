# Contract: Renderer Routing

## 목적

renderer의 node type/UI behavior 결정 기준을 tag-name 중심에서 capability/content 기반으로 전환한다.

## Routing Inputs

- `semanticRole`
- `capabilities`
- `content.kind`
- `sourceMeta`

## Routing Priority

1. content-kind contract (`media/markdown/sequence`) 우선
2. capability profile (`frame/material/texture/attach/...`)
3. semantic role
4. legacy tag-name fallback (Phase 1~2 한정)

## Rules

- 같은 canonical capability/content 조합이면 alias 이름이 달라도 동일한 렌더 동작을 가져야 한다.
- legacy-inferred canonical object는 explicit canonical object와 동일한 routing 규칙을 따라야 한다.
- `sticky-note` semantic은 일부 sticky-default capability가 제거되어도 routeable 해야 한다.
- fallback 경로는 점진적으로 축소한다.
- renderer는 canonical object를 입력으로 받고 alias 이름을 직접 분기 기준으로 삼지 않는다.

## Failure Contract

- routing 불가능: `RENDER_ROUTE_UNRESOLVED`
- fallback 의존 경고: `LEGACY_ROUTE_FALLBACK_USED`
