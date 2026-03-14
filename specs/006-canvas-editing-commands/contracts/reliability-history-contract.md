# Contract: Reliability and History

## 목적

버전 충돌, rollback, file sync, undo/redo의 일관된 동작 계약을 정의한다.

## Contract Surface

### Version / Sync Fields

- `baseVersion`
- `originId`
- `commandId`
- `newVersion`
- `file.changed`

### Completion Event

- move/content/style/rename/create/reparent는 성공 후 completion event 1건을 기록한다.
- undo/redo는 completion event 1건을 inverse/replay 한다.

## Behavioral Guarantees

- 버전 충돌 시 patch는 반영되지 않아야 한다.
- 실패 시 optimistic 변경은 롤백되어야 한다.
- 동일 `originId + commandId`에서 발생한 `file.changed`는 self-origin으로 무시할 수 있어야 한다.
- undo 1회는 completion event 1건만 되돌린다.
- redo 1회는 직전 undo event 1건만 복원한다.
- read-only 대상에는 commit event가 기록되면 안 된다.

## Error Handling

- `VERSION_CONFLICT`: 저장 거부 + 재동기화 안내
- `ID_COLLISION`: 저장 거부 + 중복 해결 안내
- `NODE_NOT_FOUND`: 저장 거부 + 최신 상태 확인 안내
- `PATCH_FAILED`: 저장 거부 + 이전 상태 복원
- `MINDMAP_CYCLE`: 구조 편집 거부 + cycle 안내

## Out of Scope

- collaborative OT/CRDT history merge
- global timeline UI
