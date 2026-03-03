# Context Tool Menu

## 개요

캔버스에서 우클릭 시 표시되는 컨텍스트 메뉴입니다. 노드 또는 빈 캔버스 영역에 따라 다른 메뉴 아이템을 제공합니다.

| 대상 | 트리거 | 메뉴 예시 |
|------|--------|----------|
| 노드 | 노드 우클릭 | PNG로 복사, 선택 항목 내보내기, 그룹 선택 |
| 캔버스 | 빈 영역 우클릭 | 전체 내보내기, 화면에 맞추기 |

```
┌──────────────────────────────────┐
│  Magam Canvas               │
│                                  │
│   ┌───────┐                      │
│   │ Node  │ ← 우클릭             │
│   └───────┘                      │
│        ┌──────────────────┐      │
│        │ 📋 PNG로 복사     │      │
│        │ 📤 선택 항목 내보내기│     │
│        │ ─────────────── │      │
│        │ 🔲 그룹 선택     │      │
│        └──────────────────┘      │
└──────────────────────────────────┘
```

---

## 설계 원칙: 선언적 플러그인 구조

메뉴 아이템을 **선언적 레지스트리**로 관리합니다. 새 메뉴 항목을 추가할 때 컴포넌트 코드를 수정할 필요 없이 레지스트리에 객체를 추가하면 됩니다.

```
선언적 레지스트리 (contextMenuItems.ts)
  → useContextMenu 훅이 target에 따라 필터링
  → ContextMenu 컴포넌트가 렌더링
```

**장점:**

| 비교 | 하드코딩 방식 | 레지스트리 방식 |
|------|-------------|---------------|
| 메뉴 추가 | 컴포넌트 JSX 수정 | **레지스트리에 객체 추가** |
| 조건부 표시 | if문 중첩 | **`when` 함수로 선언** |
| 분류/정렬 | 수동 관리 | **`group`과 `order`로 자동** |
| 테스트 | 컴포넌트 렌더링 필요 | **단위 테스트 가능** |

---

## 핵심 타입 정의

```typescript
// app/types/contextMenu.ts

/** 메뉴가 표시되는 대상 */
type ContextMenuTargetType = 'node' | 'pane';

/** 메뉴 열릴 때 전달되는 컨텍스트 */
interface ContextMenuContext {
  type: ContextMenuTargetType;
  /** 우클릭 화면 좌표 */
  position: { x: number; y: number };
  /** type === 'node'일 때 해당 노드 ID */
  nodeId?: string;
  /** 현재 선택된 노드 ID 목록 */
  selectedNodeIds: string[];
}

/** 메뉴 아이템 (실행 가능한 액션) */
interface ContextMenuAction {
  type: 'action';
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  /** 키보드 단축키 표시용 (실행은 별도) */
  shortcut?: string;
  /** 메뉴 아이템이 보일 조건. false 반환 시 숨김 */
  when?: (ctx: ContextMenuContext) => boolean;
  /** 클릭 시 실행할 핸들러 */
  handler: (ctx: ContextMenuContext) => void;
  /** 그룹 내 정렬 순서 (작을수록 위) */
  order?: number;
}

/** 구분선 */
interface ContextMenuSeparator {
  type: 'separator';
}

/** 서브메뉴 */
interface ContextMenuSubmenu {
  type: 'submenu';
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  when?: (ctx: ContextMenuContext) => boolean;
  children: ContextMenuItem[];
}

/** 메뉴 아이템 유니온 타입 */
type ContextMenuItem =
  | ContextMenuAction
  | ContextMenuSeparator
  | ContextMenuSubmenu;
```

### 타입 관계 다이어그램

```
ContextMenuItem (union)
├── ContextMenuAction     { type: 'action', handler() }
├── ContextMenuSeparator  { type: 'separator' }
└── ContextMenuSubmenu    { type: 'submenu', children[] }
         │
         └── ContextMenuItem[]  (재귀 구조)

ContextMenuContext
├── type: 'node' | 'pane'
├── position: { x, y }
├── nodeId?: string
└── selectedNodeIds: string[]
```

---

## 메뉴 아이템 레지스트리

```typescript
// app/config/contextMenuItems.ts

import { Copy, Download, Maximize, MousePointerSquareDashed } from 'lucide-react';
import type { ContextMenuItem, ContextMenuContext } from '@/types/contextMenu';

/** 노드 우클릭 메뉴 */
export const nodeMenuItems: ContextMenuItem[] = [
  {
    type: 'action',
    id: 'copy-as-png',
    label: 'PNG로 복사',
    icon: Copy,
    shortcut: '⌘⇧C',
    handler: (ctx) => {
      // useExportImage의 copyImageToClipboard 호출
    },
    order: 1,
  },
  {
    type: 'action',
    id: 'export-selection',
    label: '선택 항목 내보내기',
    icon: Download,
    when: (ctx) => ctx.selectedNodeIds.length > 0,
    handler: (ctx) => {
      // ExportDialog 모달 열기 (선택 영역 모드)
    },
    order: 2,
  },
  { type: 'separator' },
  {
    type: 'action',
    id: 'select-group',
    label: '그룹 선택',
    icon: MousePointerSquareDashed,
    when: (ctx) => ctx.nodeId !== undefined,
    handler: (ctx) => {
      // 해당 노드가 속한 MindMap 그룹의 모든 노드 선택
    },
    order: 10,
  },
];

/** 캔버스(빈 영역) 우클릭 메뉴 */
export const paneMenuItems: ContextMenuItem[] = [
  {
    type: 'action',
    id: 'export-all',
    label: '전체 내보내기',
    icon: Download,
    handler: (ctx) => {
      // ExportDialog 모달 열기 (전체 영역 모드)
    },
    order: 1,
  },
  { type: 'separator' },
  {
    type: 'action',
    id: 'fit-view',
    label: '화면에 맞추기',
    icon: Maximize,
    shortcut: 'Space',
    handler: (ctx) => {
      // ReactFlow fitView() 호출
    },
    order: 10,
  },
];
```

---

## 컴포넌트 구조

### useContextMenu 훅

메뉴 상태 관리 + 레지스트리 필터링을 담당합니다.

```typescript
// app/hooks/useContextMenu.ts

import { useState, useCallback } from 'react';
import type { ContextMenuContext, ContextMenuItem } from '@/types/contextMenu';
import { nodeMenuItems, paneMenuItems } from '@/config/contextMenuItems';

interface ContextMenuState {
  isOpen: boolean;
  context: ContextMenuContext | null;
  items: ContextMenuItem[];
}

export function useContextMenu() {
  const [state, setState] = useState<ContextMenuState>({
    isOpen: false,
    context: null,
    items: [],
  });

  /** 메뉴 열기 — target에 맞는 아이템을 필터링 */
  const openMenu = useCallback((ctx: ContextMenuContext) => {
    const rawItems = ctx.type === 'node' ? nodeMenuItems : paneMenuItems;

    // when 조건으로 필터링
    const filtered = rawItems.filter((item) => {
      if (item.type === 'separator') return true;
      if ('when' in item && item.when) return item.when(ctx);
      return true;
    });

    setState({ isOpen: true, context: ctx, items: filtered });
  }, []);

  /** 메뉴 닫기 */
  const closeMenu = useCallback(() => {
    setState({ isOpen: false, context: null, items: [] });
  }, []);

  return { ...state, openMenu, closeMenu };
}
```

### ContextMenu 컴포넌트

React Portal로 `document.body`에 렌더링합니다. 외부 클릭 시 자동으로 닫힙니다.

```typescript
// app/components/ContextMenu.tsx

import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/utils/cn';
import type { ContextMenuItem, ContextMenuContext } from '@/types/contextMenu';

interface ContextMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  items: ContextMenuItem[];
  context: ContextMenuContext;
  onClose: () => void;
}

export function ContextMenu({ isOpen, position, items, context, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // 외부 클릭 시 닫기
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as HTMLElement)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen, onClose]);

  // ESC 키로 닫기
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      ref={menuRef}
      className={cn(
        'fixed z-[200] min-w-[200px] py-1',
        'bg-white dark:bg-slate-900',
        'border border-slate-200 dark:border-slate-700',
        'rounded-lg shadow-xl',
        'animate-in fade-in zoom-in-95 duration-100',
      )}
      style={{ top: position.y, left: position.x }}
    >
      {items.map((item, i) => {
        if (item.type === 'separator') {
          return <div key={`sep-${i}`} className="h-px mx-2 my-1 bg-slate-200 dark:bg-slate-700" />;
        }
        if (item.type === 'action') {
          return (
            <button
              key={item.id}
              className={cn(
                'w-full px-3 py-2 text-left text-sm flex items-center gap-2',
                'hover:bg-slate-100 dark:hover:bg-slate-800',
                'text-slate-700 dark:text-slate-300',
              )}
              onClick={() => {
                item.handler(context);
                onClose();
              }}
            >
              {item.icon && <item.icon className="w-4 h-4 text-slate-400" />}
              <span className="flex-1">{item.label}</span>
              {item.shortcut && (
                <span className="text-xs text-slate-400 ml-4">{item.shortcut}</span>
              )}
            </button>
          );
        }
        // submenu는 Phase 2에서 구현
        return null;
      })}
    </div>,
    document.body,
  );
}
```

### 컴포넌트 관계 다이어그램

```
GraphCanvas.tsx
├── onNodeContextMenu ──┐
├── onPaneContextMenu ──┤
│                       ▼
│              useContextMenu()
│              ├── openMenu(ctx)  → 레지스트리 필터링
│              ├── closeMenu()
│              └── state: { isOpen, position, items, context }
│                       │
│                       ▼
└── <ContextMenu />  (React Portal → document.body)
    ├── ContextMenuAction  → handler(ctx) 실행
    ├── ContextMenuSeparator
    └── ContextMenuSubmenu → (Phase 2)
```

---

## 통합 방식: GraphCanvas.tsx

ReactFlow의 `onNodeContextMenu`과 `onPaneContextMenu` 이벤트 핸들러를 추가합니다.

```tsx
// app/components/GraphCanvas.tsx — 변경 부분

import { useContextMenu } from '@/hooks/useContextMenu';
import { ContextMenu } from './ContextMenu';

function GraphCanvasContent() {
  // ... 기존 코드 ...
  const { isOpen, context, items, openMenu, closeMenu } = useContextMenu();

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      const { selectedNodeIds } = useGraphStore.getState();
      openMenu({
        type: 'node',
        position: { x: event.clientX, y: event.clientY },
        nodeId: node.id,
        selectedNodeIds,
      });
    },
    [openMenu],
  );

  const onPaneContextMenu = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      openMenu({
        type: 'pane',
        position: { x: event.clientX, y: event.clientY },
        selectedNodeIds: [],
      });
    },
    [openMenu],
  );

  return (
    <>
      {/* ... 기존 코드 ... */}
      <ReactFlow
        // ... 기존 props ...
        onNodeContextMenu={onNodeContextMenu}
        onPaneContextMenu={onPaneContextMenu}
      >
        {/* ... */}
      </ReactFlow>

      {/* Context Menu (Portal) */}
      {isOpen && context && (
        <ContextMenu
          isOpen={isOpen}
          position={context.position}
          items={items}
          context={context}
          onClose={closeMenu}
        />
      )}
    </>
  );
}
```

### ReactFlow 이벤트 핸들러 매핑

| ReactFlow prop | 트리거 | ContextMenuContext.type |
|----------------|--------|------------------------|
| `onNodeContextMenu` | 노드 위에서 우클릭 | `'node'` |
| `onPaneContextMenu` | 빈 캔버스에서 우클릭 | `'pane'` |

두 핸들러 모두 `event.preventDefault()`로 브라우저 기본 컨텍스트 메뉴를 차단합니다.

---

## 구현 파일 목록

### 새로 생성할 파일

| 파일 | 역할 | 줄 수 (추정) |
|------|------|-------------|
| `app/types/contextMenu.ts` | 확장 가능한 메뉴 타입 시스템 | ~50 |
| `app/config/contextMenuItems.ts` | 노드/캔버스 메뉴 아이템 레지스트리 | ~80 |
| `app/hooks/useContextMenu.ts` | 메뉴 상태 관리 + 필터링 훅 | ~50 |
| `app/components/ContextMenu.tsx` | Portal 기반 컨텍스트 메뉴 UI | ~100 |

### 수정할 파일

| 파일 | 변경 내용 | 변경량 |
|------|----------|--------|
| `app/components/GraphCanvas.tsx` | `onNodeContextMenu` / `onPaneContextMenu` 핸들러 추가, ContextMenu 렌더링 | ~30줄 추가 |

---

## 구현 단계

### Phase 1: 타입 + 훅 + 기본 메뉴

| 작업 | 파일 |
|------|------|
| 타입 정의 생성 | `app/types/contextMenu.ts` |
| 메뉴 레지스트리 생성 | `app/config/contextMenuItems.ts` |
| useContextMenu 훅 구현 | `app/hooks/useContextMenu.ts` |

**완료 기준**: 타입이 정의되고 훅이 메뉴 아이템을 target별로 필터링할 수 있음.

### Phase 2: UI 컴포넌트 + 통합

| 작업 | 파일 |
|------|------|
| ContextMenu 컴포넌트 구현 | `app/components/ContextMenu.tsx` |
| GraphCanvas에 이벤트 핸들러 통합 | `app/components/GraphCanvas.tsx` |
| 외부 클릭 / ESC 닫기 동작 확인 | — |

**완료 기준**: 노드 우클릭 시 노드 메뉴가, 빈 영역 우클릭 시 캔버스 메뉴가 표시되고 외부 클릭/ESC로 닫힘.

### Phase 3: 핸들러 연결 + 서브메뉴

| 작업 | 파일 |
|------|------|
| "PNG로 복사" 핸들러 구현 (useExportImage 연동) | `app/config/contextMenuItems.ts` |
| "화면에 맞추기" 핸들러 연결 (fitView) | `app/config/contextMenuItems.ts` |
| "그룹 선택" 핸들러 구현 | `app/config/contextMenuItems.ts` |
| 서브메뉴 렌더링 (ContextMenuSubmenu) | `app/components/ContextMenu.tsx` |

**완료 기준**: 모든 메뉴 아이템의 handler가 실제 동작하며, 서브메뉴가 hover 시 펼쳐짐.

---

## UI 스타일 가이드

기존 `FloatingToolbar` 컴포넌트의 디자인 톤을 따릅니다.

| 속성 | 값 |
|------|-----|
| 배경 | `bg-white/90 dark:bg-slate-900/90 backdrop-blur-md` |
| 테두리 | `border-slate-200 dark:border-slate-700` |
| 라운딩 | `rounded-lg` |
| 그림자 | `shadow-xl` |
| 호버 | `hover:bg-slate-100 dark:hover:bg-slate-800` |
| 텍스트 | `text-sm text-slate-700 dark:text-slate-300` |
| 아이콘 | lucide-react, `w-4 h-4 text-slate-400` |
| 애니메이션 | `animate-in fade-in zoom-in-95 duration-100` |
| z-index | `z-[200]` (FloatingToolbar z-50 위에) |

---

## 접근성 고려사항

| 항목 | 구현 |
|------|------|
| 키보드 닫기 | ESC 키로 메뉴 닫기 |
| 포커스 트랩 | 메뉴 열릴 때 첫 번째 아이템에 자동 포커스 |
| 화살표 키 | ↑↓로 아이템 간 이동 (Phase 3) |
| ARIA 역할 | `role="menu"`, `role="menuitem"` |
| 화면 밖 보정 | 메뉴가 뷰포트를 벗어나면 위치 보정 |
