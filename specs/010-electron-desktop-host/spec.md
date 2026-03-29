# Feature Specification: Electron Desktop Host

**Feature Branch**: `010-electron-desktop-host`  
**Created**: 2026-03-20  
**Status**: Draft  
**Input**: User description: "`/Users/danghamo/Documents/gituhb/magam-feature-electron-desktop-host/docs/features/electron-desktop-host/README.md` (supporting context: `/Users/danghamo/Documents/gituhb/magam-feature-electron-desktop-host/docs/adr/ADR-0010-electron-primary-host-and-nextjs-de-emphasis.md`)"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 데스크톱 직접 진입 경로 확보 (Priority: P1)

데스크톱 사용자는 Next.js route handler에 의존하지 않고 Electron renderer에서 바로 workspace authoring 화면을 열 수 있어야 한다.

**Why this priority**: primary host 전환의 핵심 가치가 startup critical path에서 web host compile 비용 제거이기 때문이다.

**Independent Test**: desktop dev/start 명령으로 앱을 실행하고 workspace를 열었을 때 `Next.js` route compile 로그 없이 편집 화면까지 진입하면 독립 검증 가능하다.

**Acceptance Scenarios**:

1. **Given** local workspace가 존재할 때, **When** Electron 앱을 cold start하면, **Then** renderer는 Next.js route handler 호출 없이 workspace를 연다.
2. **Given** desktop primary startup path를 실행할 때, **When** 초기 데이터가 로드되면, **Then** files/file-tree/render 필수 초기 호출은 RPC adapter 경유로 완료된다.

---

### User Story 2 - Host-agnostic Renderer 경계 고정 (Priority: P1)

제품 개발자는 `WorkspaceClient`, `GraphCanvas`, store/process/runtime 계층이 특정 host framework에 종속되지 않고 host-neutral renderer app으로 유지되길 원한다.

**Why this priority**: renderer가 host 종속 코드를 직접 소유하면 Electron 전환 후에도 재사용성과 경계 안정성이 무너진다.

**Independent Test**: renderer domain 모듈에서 `electron`, `/api/*`, Next.js route primitive 직접 의존이 사라지고, host capability/RPC interface만 참조하는지 확인하면 독립 검증 가능하다.

**Acceptance Scenarios**:

1. **Given** renderer domain 코드가 로드될 때, **When** 의존성 그래프를 점검하면, **Then** renderer는 host capability interface와 RPC client interface만 의존한다.
2. **Given** 동일한 logical RPC method 집합이 정의될 때, **When** Electron adapter와 optional web adapter를 비교하면, **Then** method surface가 일관되게 유지된다.

---

### User Story 3 - Desktop Host Lifecycle/Capability 분리 (Priority: P2)

플랫폼 개발자는 Electron main/preload가 lifecycle/orchestration/capability bridge만 소유하고 제품 도메인 로직 owner가 되지 않길 원한다.

**Why this priority**: host 계층이 도메인 로직을 흡수하면 의존성 역전과 보안 경계 확장으로 이후 유지보수 비용이 급증한다.

**Independent Test**: main/preload 계층에서 허용 capability만 노출되고 renderer의 편집 판단/도메인 mutation 로직이 host로 이동하지 않았는지 확인하면 독립 검증 가능하다.

**Acceptance Scenarios**:

1. **Given** preload bridge가 renderer에 API를 노출할 때, **When** exposed surface를 검사하면, **Then** capability 단위의 최소 권한 API만 제공된다.
2. **Given** main process가 앱 lifecycle을 관리할 때, **When** workspace bootstrap과 backend orchestration이 수행되면, **Then** canvas domain editability/command 판단은 renderer/backend 경계에 남는다.

---

### User Story 4 - Next.js Secondary Surface 강등 (Priority: P2)

제품/플랫폼 팀은 Next.js가 남아도 primary authoring runtime이 아니라 viewer/debug/review 용 compatibility adapter로만 동작하길 원한다.

**Why this priority**: primary ownership을 명확히 고정하지 않으면 desktop host 전환 후에도 startup/path 의존 회귀가 반복된다.

**Independent Test**: authoring critical flow가 web host availability와 무관하게 동작하고, web surface는 동일 RPC contract를 소비하는지 확인하면 독립 검증 가능하다.

**Acceptance Scenarios**:

1. **Given** Next.js surface가 비활성 상태일 때, **When** desktop authoring flow를 실행하면, **Then** 파일 목록/트리/렌더/편집/동기화의 핵심 기능은 계속 동작한다.
2. **Given** optional web surface를 실행할 때, **When** 기능 호출을 수행하면, **Then** desktop과 동일한 logical RPC method를 사용한다.

### Edge Cases

- Electron preload가 과도한 Node/Electron primitive를 renderer에 노출하려는 변경은 capability boundary 위반으로 거부돼야 한다.
- desktop bootstrap 중 backend process 지연/재시작이 발생해도 renderer 초기화 단계가 무한 대기 상태에 빠지지 않아야 한다.
- renderer 코드에 `/api/*` 직접 호출이 일부 잔존할 경우 빌드/검증 단계에서 탐지 가능해야 한다.
- optional web adapter가 desktop adapter와 다른 method contract를 노출하면 호환성 회귀로 탐지돼야 한다.
- Next.js dev server가 실행되지 않은 상태에서도 desktop primary dev loop가 정상 동작해야 한다.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 시스템은 Electron을 primary application host로 사용해야 한다.
- **FR-002**: 시스템은 desktop renderer가 Next.js route handler 없이 workspace를 열 수 있어야 한다.
- **FR-003**: 시스템은 renderer의 필수 데이터 경로(files, file-tree, render, edit, sync)를 transport-independent RPC adapter를 통해 호출해야 한다.
- **FR-004**: 시스템은 renderer 코드에서 필수 `/api/*` fetch dependency를 제거해야 한다.
- **FR-005**: 시스템은 renderer product logic이 host-neutral app 구조로 분리되어야 한다.
- **FR-006**: 시스템은 renderer가 host capability interface와 RPC client interface만 직접 참조하도록 보장해야 한다.
- **FR-007**: 시스템은 Electron main이 window lifecycle, workspace bootstrap, backend orchestration 책임만 소유해야 한다.
- **FR-008**: 시스템은 Electron preload가 최소 권한 capability bridge만 노출해야 한다.
- **FR-009**: 시스템은 Electron preload가 renderer에 광범위한 Node/Electron 권한을 직접 노출하지 않아야 한다.
- **FR-010**: 시스템은 host adapter 차이를 adapter layer로 제한하고 renderer domain 계층으로 누수시키지 않아야 한다.
- **FR-011**: 시스템은 Electron adapter와 optional web adapter가 동일 logical RPC method 집합을 공유해야 한다.
- **FR-012**: 시스템은 primary startup path에서 Next.js cold route compile을 제거해야 한다.
- **FR-013**: 시스템은 desktop primary dev bootstrap이 Electron + local backend를 함께 기동해야 한다.
- **FR-014**: 시스템은 Next.js dev server를 primary path가 아닌 optional 보조 경로로 유지해야 한다.
- **FR-015**: 시스템은 product-critical authoring flow가 web host availability에 의존하지 않아야 한다.
- **FR-016**: 시스템은 Next.js가 남아있을 경우 viewer/debug/review의 secondary surface로만 동작해야 한다.
- **FR-017**: 시스템은 기존 domain RPC logical contract를 이번 범위에서 전면 재설계하지 않아야 한다.
- **FR-018**: 시스템은 web surface 완전 삭제를 이번 범위의 필수 조건으로 두지 않아야 한다.
- **FR-019**: 시스템은 persistence 방향 재결정을 이번 범위에 포함하지 않아야 한다.
- **FR-020**: 시스템은 auto-update/code-signing/distribution channel 결정을 이번 범위에 포함하지 않아야 한다.

### Key Entities *(include if feature involves data)*

- **Renderer App**: `WorkspaceClient`, `GraphCanvas`, store/process/runtime을 포함하는 host-neutral product runtime.
- **Host Capability Interface**: renderer가 host-specific 기능(예: native dialog, OS integration)에 접근하는 최소 권한 계약.
- **RPC Client Interface**: renderer가 files/file-tree/render/edit/sync logical method를 호출하는 transport-independent 계약.
- **Electron Main Host**: window lifecycle, bootstrap, backend orchestration를 담당하는 desktop host owner.
- **Electron Preload Bridge**: renderer와 main/backend 사이 capability 노출 경계를 담당하는 보안 bridge 계층.
- **Host Adapters**: Electron adapter와 optional web adapter로 구성되며 동일 logical RPC contract를 구현하는 계층.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: desktop cold start 회귀 검증에서 workspace authoring 진입 경로가 100% Next.js route handler 미경유로 동작한다.
- **SC-002**: renderer 코드 정적 검증에서 필수 `/api/*` 직접 의존이 0건이다.
- **SC-003**: files/file-tree/render/edit/sync 핵심 경로 회귀 시나리오의 100%가 RPC adapter 경유로 통과한다.
- **SC-004**: desktop primary dev loop에서 Next.js route compile이 startup critical path에 나타나는 케이스가 0건이다.
- **SC-005**: optional web surface가 있을 때 desktop과 web 간 logical RPC method parity 회귀 시나리오의 100%를 통과한다.
- **SC-006**: host capability 보안 점검에서 preload 노출 API가 정의된 최소 권한 surface만 포함하고, 직접 Node/Electron 권한 누수가 0건이다.

## Assumptions

- 기존 local backend(files/file-tree/render/edit/sync) 자산은 유지하며 host 전환 중 재사용 가능하다.
- renderer domain 로직은 host adapter 경계 정리만으로 단계적 전환이 가능하다.
- optional web surface는 제품 핵심 authoring ownership을 가지지 않는 보조 용도로 유지 가능하다.

## Dependencies

- `/Users/danghamo/Documents/gituhb/magam-feature-electron-desktop-host/docs/features/electron-desktop-host/README.md`
- `/Users/danghamo/Documents/gituhb/magam-feature-electron-desktop-host/docs/adr/ADR-0010-electron-primary-host-and-nextjs-de-emphasis.md`
- `/Users/danghamo/Documents/gituhb/magam-feature-electron-desktop-host/specs/007-object-capability-composition/spec.md`

## Out of Scope

- 기존 domain RPC method 전면 재설계
- web surface 즉시 완전 삭제
- persistence 전략 재결정
- auto-update/code-signing/배포 채널 정책 확정
