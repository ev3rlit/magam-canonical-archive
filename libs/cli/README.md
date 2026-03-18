# CLI

`@magam/cli`는 legacy render/dev 명령과 database-first headless surface를 함께 제공한다.

## Headless Surface

지원하는 resource/subcommand는 다음과 같다.

```bash
magam workspace list --json
magam workspace get --workspace ws-smoke --json
magam document get --document doc-smoke --json
magam surface get --document doc-smoke --surface main --json
magam surface query-nodes --document doc-smoke --surface main --bounds 0,0,800,600 --json
magam object get --workspace ws-smoke --object note-1 --json
magam object query --workspace ws-smoke --semantic-role sticky-note --json
magam search objects --workspace ws-smoke --text "launch checklist" --json
magam search documents --workspace ws-smoke --text "launch checklist" --json
magam canvas-node move --document doc-smoke --node node-1 --x 12 --y 34 --json
magam canvas-node reparent --document doc-smoke --node node-1 --parent group-1 --json
printf '{"source":"# hello"}' | magam object update-content --workspace ws-smoke --document doc-smoke --object note-1 --kind markdown --patch @stdin --json
printf '{"fill":"#FDE68A"}' | magam object patch-capability --workspace ws-smoke --document doc-smoke --object note-1 --capability frame --patch @stdin --json
printf '{"workspaceRef":"ws-smoke","documentRef":"doc-smoke","operations":[{"op":"canvas.node.move","nodeId":"node-1","patch":{"x":12,"y":34}}]}' | magam mutation apply --json
```

## JSON Contract

- `--json`에서는 success/failure 모두 structured envelope를 반환한다.
- failure는 `ok: false`, `error.code`, `error.message`, `error.details`, `error.retryable`를 포함한다.
- mutation 명령은 가능하면 `documentRevisionBefore`, `documentRevisionAfter`, `changed`, `warnings`를 함께 반환한다.

## Runtime Notes

- 현재 headless implementation은 dedicated `workspaces` / `documents` table 없이 canonical rows에서 `workspace` / `document` summary를 유도한다.
- default workspace ref는 현재 디렉터리 basename 또는 `MAGAM_WORKSPACE_ID`에서 유도한다.
- canonical DB는 `MAGAM_CANONICAL_DB_PATH`가 있으면 그 경로를 사용하고, 없으면 `<targetDir>/.magam/canonical-pgdata`를 사용한다.

## Build

```bash
bun run --filter '@magam/cli' build
```

## Test

```bash
bun test libs/shared/src/lib/canonical-query/headless-query.spec.ts
bun test libs/shared/src/lib/canonical-mutation/executor.spec.ts
```
