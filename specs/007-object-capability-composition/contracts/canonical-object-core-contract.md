# Contract: Canonical Object Core

## 목적

모든 일반 canvas object가 공유하는 내부 canonical core 계약을 고정한다.

## Core Shape

```ts
type ObjectCore = {
  id: string;
  position?: { x?: number; y?: number };
  relations?: { from?: unknown; to?: unknown; anchor?: unknown };
  children?: unknown[];
  className?: string;
  sourceMeta: {
    sourceId: string;
    filePath?: string;
    scopeId?: string;
    kind?: 'canvas' | 'mindmap';
    [k: string]: unknown;
  };
};
```

## Invariants

1. `id`는 필수이며 source scope에서 유일해야 한다.
2. `sourceMeta.sourceId`는 필수 문자열이어야 한다.
3. role/content/capability는 core 밖에서 관리한다.
4. public alias는 core를 우회해 내부 전용 모델을 만들지 않는다.

## Failure Contract

- 위반 시 `INVALID_OBJECT_CORE`로 reject한다.

