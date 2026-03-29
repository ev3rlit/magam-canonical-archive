# Quickstart: Electron Desktop Host

## 목적

`010-electron-desktop-host` 스펙/플랜 기반으로 구현 준비와 검증 경로를 고정한다.

## 작업 문서 링크

- 스펙: `specs/010-electron-desktop-host/spec.md`
- 플랜: `specs/010-electron-desktop-host/plan.md`
- 리서치: `specs/010-electron-desktop-host/research.md`
- 데이터 모델: `specs/010-electron-desktop-host/data-model.md`
- 계약:
  - `specs/010-electron-desktop-host/contracts/host-capability-bridge-contract.md`
  - `specs/010-electron-desktop-host/contracts/rpc-adapter-parity-contract.md`
  - `specs/010-electron-desktop-host/contracts/desktop-bootstrap-contract.md`
  - `specs/010-electron-desktop-host/contracts/optional-web-adapter-boundary-contract.md`

## 1) 준비

```bash
cd /Users/danghamo/Documents/gituhb/magam-feature-electron-desktop-host
bun install
```

## 2) 구현 순서 (요약)

1. renderer host-neutral entry와 host capability/RPC interface 경계 고정
2. desktop main/preload bootstrap 경로 추가 및 backend orchestration 연결
3. renderer `/api/*` 의존을 logical RPC adapter 호출로 대체
4. desktop primary dev loop 구성 (`Electron + local backend`)
5. Next.js surface를 secondary adapter 역할로 정렬하고 parity 검증 추가

## 3) 체크포인트

- Checkpoint A: desktop renderer가 Next.js route handler 없이 workspace를 연다.
- Checkpoint B: renderer 필수 경로에 `/api/*` 직접 fetch 의존이 없다.
- Checkpoint C: files/file-tree/render/edit/sync 경로가 RPC adapter 경유로 동작한다.
- Checkpoint D: desktop startup critical path에서 Next.js route compile 의존이 없다.
- Checkpoint E: preload bridge가 최소 권한 capability만 노출한다.
- Checkpoint F: optional web adapter가 logical RPC method parity를 유지한다.

## 4) 테스트 가이드

```bash
bun dev

# 기존 web host bootstrap이 필요하면
bun run web:dev

# 단위/통합 회귀
bun test app/components/editor/WorkspaceClient.test.tsx app/hooks/useFileSync.test.ts scripts/dev/app-dev.test.ts scripts/dev/desktop-dev.test.ts

# 타입 검증
bun run typecheck:app

# desktop/web RPC parity
bun --cwd app -e "import { createDesktopRpcAdapter } from './features/host/rpc/desktopAdapter'; import { createWebRpcAdapter } from './features/host/rpc/webAdapter'; import { validateAdapterParity } from './features/host/rpc/validateParity'; const report = validateAdapterParity({ desktop: createDesktopRpcAdapter({ runtimeConfig: { mode: 'desktop-primary', httpBaseUrl: 'http://127.0.0.1:3012', wsUrl: 'ws://127.0.0.1:3013', workspacePath: null } }).descriptor, web: createWebRpcAdapter().descriptor }); console.log(JSON.stringify(report));"

# desktop primary path smoke (without Next.js dev server)
bun run desktop:dev -- --headless
```

## 5) 수동 검증 시나리오

1. desktop cold start로 workspace를 열어 authoring 진입이 Next.js route compile 없이 가능한지 확인한다.
2. 파일 목록/트리/렌더/편집/동기화의 주요 경로가 adapter를 통해 정상 동작하는지 확인한다.
3. preload bridge 노출 API를 점검해 raw Node/Electron primitive 누출이 없는지 확인한다.
4. Next.js surface를 중단한 상태에서도 desktop authoring flow가 유지되는지 확인한다.
5. optional web surface 실행 시 desktop과 같은 logical RPC method set을 사용하는지 확인한다.

## 6) 정량 검증 기준

- SC-001: desktop authoring 진입 경로 Next.js route handler 미경유 100%
- SC-002: renderer 필수 `/api/*` 직접 의존 0건
- SC-003: 핵심 RPC 경로 회귀 시나리오 통과율 100%
- SC-004: startup critical path 내 Next.js route compile 의존 0건
- SC-005: desktop/web adapter parity 검증 통과율 100%
- SC-006: preload 권한 누출 보안 점검 실패 0건

## 7) Verification Snapshot

- `bun run typecheck:app`: 통과
- `bun test app/components/editor/WorkspaceClient.test.tsx app/hooks/useFileSync.test.ts scripts/dev/app-dev.test.ts scripts/dev/desktop-dev.test.ts`: verification target
- desktop/web parity check: `desktopOnly=[]`, `webOnly=[]`, shared method set은 `files.list`, `fileTree.list`, `render.generate`, `edit.apply`, `sync.watch`
- 기본 dev entry: `bun dev` -> `scripts/dev/desktop-dev.ts`
- web bootstrap fallback: `bun run web:dev` -> `scripts/dev/app-dev.ts`
- `bun run desktop:dev -- --headless`: 통과
  - Electron main이 로컬 backend(`HTTP 3012`, `WS 3013`)를 직접 기동
  - renderer가 `Renderer reported ready in headless mode`까지 도달
  - `Next.js` dev server를 띄우지 않은 상태에서도 desktop bootstrap 완료

## 8) Capability Audit

- preload public capability surface:
  - `workspace.selectWorkspace`
  - `workspace.revealInOs`
  - `shell.openExternal`
  - `lifecycle.onAppEvent`
- bootstrap handshake surface:
  - `getSession`
  - `markRendererLoading`
  - `markRendererReady`
  - `markRendererFailed`
- audit result:
  - raw `ipcRenderer`, `fs`, `child_process`, `process` 객체는 renderer에 직접 노출하지 않음
  - desktop runtime config는 `httpBaseUrl`, `wsUrl`, `workspacePath`만 expose

## 9) Guardrails

- logical RPC contract는 shared `CORE_RPC_LOGICAL_METHODS`와 `validateAdapterParity`로 고정하며, 이번 범위에서 전면 재설계하지 않는다.
- optional web surface는 compatibility adapter로 유지하며, desktop primary path를 차단하지 않는다.
- persistence 방향은 본 구현 범위에서 변경하지 않는다.
- auto-update, code-signing, 배포 채널은 본 구현 범위에서 제외한다.
