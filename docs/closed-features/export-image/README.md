# Export Image

## 개요

선택 영역 또는 전체 캔버스를 이미지 파일로 내보내기합니다. Context Menu의 "내보내기" 액션에서 트리거되며, 모달 다이얼로그에서 옵션을 설정한 뒤 다운로드하거나 클립보드에 복사합니다.

```
Context Menu → "선택 항목 내보내기" / "전체 내보내기"
  → ExportDialog 모달 열림
  → 옵션 선택 (포맷, 배경, 영역)
  → 다운로드 / 클립보드 복사
```

---

## 지원 포맷

| 포맷 | MIME | 특징 |
|------|------|------|
| **PNG** | `image/png` | 투명 배경 지원, 기본 포맷 |
| **JPG** | `image/jpeg` | 파일 크기 작음, 투명 미지원 |
| **SVG** | `image/svg+xml` | 벡터, 확대 시 품질 유지 |

---

## 내보내기 옵션

### 옵션 명세

| 옵션 | UI 타입 | 값 | 기본값 |
|------|---------|-----|--------|
| 파일 유형 | 라디오 버튼 | `png` / `jpg` / `svg` | `png` |
| 배경 | 드롭다운 | `grid` / `transparent` / `solid` | `grid` |
| 내보내기 영역 | 드롭다운 | `selection` / `full` | Context에 따라 |

### 옵션 조합 매트릭스

| 포맷 \ 배경 | 그리드 | 투명 | 단색 |
|-------------|--------|------|------|
| **PNG** | O | O | O |
| **JPG** | O | X (흰색 폴백) | O |
| **SVG** | O | O | O |

> JPG는 투명 배경을 지원하지 않으므로, "투명" 선택 시 흰색(`#FFFFFF`) 배경으로 자동 폴백합니다.

### 영역 옵션 동작

| 영역 | 동작 |
|------|------|
| **선택 항목만** | `selectedNodeIds`에 해당하는 노드 영역의 bounding box를 캡처 |
| **전체 영역** | ReactFlow 뷰포트 전체를 캡처 (모든 노드 포함) |

---

## 기술 스택

### html-to-image

DOM 요소를 이미지로 변환하는 라이브러리입니다. ReactFlow의 `.react-flow__viewport` DOM을 직접 캡처합니다.

```bash
# 의존성 추가
bun add html-to-image --cwd app
```

| 비교 | html-to-image | html2canvas | dom-to-image |
|------|---------------|-------------|--------------|
| 번들 크기 | **~10KB** | ~40KB | ~15KB |
| SVG 지원 | **O** | X | O |
| 유지보수 | **활발** | 보통 | 중단 |
| TypeScript | **네이티브** | @types 필요 | @types 필요 |

**선택: `html-to-image`** — 경량, SVG 지원, TypeScript 네이티브.

### 핵심 API 매핑

| html-to-image | 용도 |
|---------------|------|
| `toPng(node, options)` | PNG Blob 생성 |
| `toJpeg(node, options)` | JPEG Blob 생성 |
| `toSvg(node, options)` | SVG 문자열 생성 |
| `toBlob(node, options)` | Blob 생성 (클립보드용) |

---

## 핵심 API: useExportImage 훅

```typescript
// app/hooks/useExportImage.ts

import { toPng, toJpeg, toSvg, toBlob } from 'html-to-image';
import { useReactFlow, getNodesBounds, getViewportForBounds } from 'reactflow';
import { useGraphStore } from '@/store/graph';

/** 내보내기 옵션 */
interface ExportOptions {
  format: 'png' | 'jpg' | 'svg';
  background: 'grid' | 'transparent' | 'solid';
  area: 'selection' | 'full';
  /** 단색 배경 색상 (background === 'solid'일 때) */
  solidColor?: string;
  /** 출력 이미지 스케일 (기본 2x for Retina) */
  scale?: number;
}

interface UseExportImageReturn {
  /** 이미지 Blob/문자열 생성 */
  exportImage: (options: ExportOptions) => Promise<Blob | string>;
  /** 파일로 다운로드 */
  downloadImage: (options: ExportOptions, filename?: string) => Promise<void>;
  /** 클립보드에 PNG로 복사 */
  copyImageToClipboard: (nodeIds?: string[]) => Promise<void>;
  /** 내보내기 진행 중 여부 */
  isExporting: boolean;
}

export function useExportImage(): UseExportImageReturn {
  // 구현 개요:
  // 1. ReactFlow 뷰포트 DOM 요소 참조 획득
  // 2. area === 'selection'이면 selectedNodeIds로 bounding box 계산
  // 3. background 옵션에 따라 캡처 옵션 구성
  // 4. html-to-image API 호출
  // 5. 결과를 Blob/다운로드/클립보드로 전달
}
```

### 내부 동작 흐름

```
exportImage(options)
│
├─ 1. DOM 참조 획득
│     document.querySelector('.react-flow__viewport')
│
├─ 2. 영역 계산
│     ├─ area === 'full'
│     │   └─ getNodesBounds(allNodes)
│     └─ area === 'selection'
│         └─ getNodesBounds(selectedNodes)
│
├─ 3. 뷰포트 변환
│     getViewportForBounds(bounds, width, height, minZoom, maxZoom)
│
├─ 4. 캡처 옵션 구성
│     ├─ background === 'transparent' → backgroundColor: undefined
│     ├─ background === 'solid'       → backgroundColor: solidColor
│     └─ background === 'grid'        → 그리드 DOM 포함하여 캡처
│
├─ 5. html-to-image 호출
│     ├─ format === 'png' → toPng(node, captureOptions)
│     ├─ format === 'jpg' → toJpeg(node, captureOptions)
│     └─ format === 'svg' → toSvg(node, captureOptions)
│
└─ 6. 결과 반환 (Blob | string)
```

### 클립보드 복사 (PNG로 복사)

```typescript
async function copyImageToClipboard(nodeIds?: string[]) {
  const blob = await exportImage({
    format: 'png',
    background: 'transparent',
    area: nodeIds ? 'selection' : 'full',
  });

  await navigator.clipboard.write([
    new ClipboardItem({ 'image/png': blob as Blob }),
  ]);
}
```

> Context Menu의 "PNG로 복사" 액션이 이 함수를 호출합니다.

---

## UI 설계: ExportDialog 모달

### 레이아웃 구조

```
┌─────────────────────────────────────────────┐
│  Export Image                          [ X ] │
├─────────────────────────────────────────────┤
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │                                     │    │
│  │         [ 미리보기 영역 ]             │    │
│  │         (캡처될 영역 축소판)          │    │
│  │                                     │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  파일 유형                                   │
│  ┌──────┐ ┌──────┐ ┌──────┐                │
│  │ PNG  │ │ JPG  │ │ SVG  │                │
│  │  ●   │ │  ○   │ │  ○   │                │
│  └──────┘ └──────┘ └──────┘                │
│                                             │
│  배경         ┌──────────────────┐          │
│               │ 그리드           ▾│          │
│               └──────────────────┘          │
│                                             │
│  내보내기 영역  ┌──────────────────┐          │
│               │ 선택 항목만       ▾│          │
│               └──────────────────┘          │
│                                             │
│  ┌──────────────────┐ ┌─────────────────┐   │
│  │  📋 클립보드 복사  │ │  💾 다운로드     │   │
│  └──────────────────┘ └─────────────────┘   │
└─────────────────────────────────────────────┘
```

### 컴포넌트 구조

```typescript
// app/components/ExportDialog.tsx

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Copy, Download } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useExportImage, type ExportOptions } from '@/hooks/useExportImage';

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** 초기 영역 모드 (Context Menu에서 전달) */
  defaultArea: 'selection' | 'full';
}

export function ExportDialog({ isOpen, onClose, defaultArea }: ExportDialogProps) {
  const [format, setFormat] = useState<ExportOptions['format']>('png');
  const [background, setBackground] = useState<ExportOptions['background']>('grid');
  const [area, setArea] = useState<ExportOptions['area']>(defaultArea);

  const { downloadImage, copyImageToClipboard, isExporting } = useExportImage();

  const handleDownload = async () => {
    await downloadImage({ format, background, area });
    onClose();
  };

  const handleCopy = async () => {
    await copyImageToClipboard();
    onClose();
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-center justify-center">
      {/* 백드롭 */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* 다이얼로그 */}
      <div className={cn(
        'relative w-[440px] bg-white dark:bg-slate-900',
        'rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700',
        'animate-in fade-in zoom-in-95 duration-200',
      )}>
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Export Image
          </h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* 본문 */}
        <div className="px-6 py-5 space-y-5">
          {/* 미리보기 */}
          <div className="w-full h-40 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center">
            <span className="text-sm text-slate-400">미리보기</span>
          </div>

          {/* 파일 유형 (라디오 버튼) */}
          <FormatSelector value={format} onChange={setFormat} />

          {/* 배경 (드롭다운) */}
          <SelectField label="배경" value={background} onChange={setBackground}
            options={[
              { value: 'grid', label: '그리드' },
              { value: 'transparent', label: '투명' },
              { value: 'solid', label: '단색 (흰색)' },
            ]}
          />

          {/* 내보내기 영역 (드롭다운) */}
          <SelectField label="내보내기 영역" value={area} onChange={setArea}
            options={[
              { value: 'selection', label: '선택 항목만' },
              { value: 'full', label: '전체 영역' },
            ]}
          />
        </div>

        {/* 푸터 */}
        <div className="flex gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-700">
          <button
            onClick={handleCopy}
            disabled={isExporting}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 px-4 py-2.5',
              'rounded-lg border border-slate-200 dark:border-slate-700',
              'text-sm font-medium text-slate-700 dark:text-slate-300',
              'hover:bg-slate-50 dark:hover:bg-slate-800',
              'disabled:opacity-50',
            )}
          >
            <Copy className="w-4 h-4" />
            클립보드 복사
          </button>
          <button
            onClick={handleDownload}
            disabled={isExporting}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 px-4 py-2.5',
              'rounded-lg bg-blue-600 text-white text-sm font-medium',
              'hover:bg-blue-700',
              'disabled:opacity-50',
            )}
          >
            <Download className="w-4 h-4" />
            다운로드
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
```

### UI 스타일 가이드

기존 프로젝트의 디자인 톤과 일관성을 유지합니다.

| 속성 | 값 |
|------|-----|
| 백드롭 | `bg-black/50 backdrop-blur-sm` |
| 다이얼로그 배경 | `bg-white dark:bg-slate-900` |
| 라운딩 | `rounded-2xl` |
| 그림자 | `shadow-2xl` |
| 테두리 | `border-slate-200 dark:border-slate-700` |
| 기본 버튼 | `bg-blue-600 hover:bg-blue-700 text-white` |
| 보조 버튼 | `border-slate-200 text-slate-700` |
| z-index | `z-[300]` (ContextMenu z-[200] 위에) |
| 애니메이션 | `animate-in fade-in zoom-in-95 duration-200` |

---

## 통합 방식: Context Menu와 연동

ExportDialog는 Context Menu의 내보내기 액션에서 트리거됩니다.

### 상태 관리 흐름

```
contextMenuItems.ts
├── "선택 항목 내보내기" handler
│   └── setExportDialog({ isOpen: true, defaultArea: 'selection' })
└── "전체 내보내기" handler
    └── setExportDialog({ isOpen: true, defaultArea: 'full' })
         │
         ▼
GraphCanvas.tsx
└── <ExportDialog isOpen={...} defaultArea={...} onClose={...} />
```

### GraphCanvas.tsx 통합

```tsx
// GraphCanvas.tsx — ExportDialog 상태 추가

function GraphCanvasContent() {
  // ... 기존 코드 ...
  const [exportDialog, setExportDialog] = useState<{
    isOpen: boolean;
    defaultArea: 'selection' | 'full';
  }>({ isOpen: false, defaultArea: 'full' });

  return (
    <>
      {/* ... 기존 코드 ... */}

      {/* Export Dialog (Portal) */}
      <ExportDialog
        isOpen={exportDialog.isOpen}
        defaultArea={exportDialog.defaultArea}
        onClose={() => setExportDialog({ isOpen: false, defaultArea: 'full' })}
      />
    </>
  );
}
```

### Context Menu 핸들러 연결

```typescript
// contextMenuItems.ts — handler에서 ExportDialog 열기

// 방법: Context Menu handler에 setExportDialog 콜백을 주입
// GraphCanvas에서 useContextMenu 초기화 시 handler context에 포함

{
  type: 'action',
  id: 'export-selection',
  label: '선택 항목 내보내기',
  icon: Download,
  when: (ctx) => ctx.selectedNodeIds.length > 0,
  handler: (ctx) => {
    // ctx.actions.openExportDialog('selection')
    // GraphCanvas에서 주입한 콜백 사용
  },
  order: 2,
},
```

---

## 구현 파일 목록

### 새로 생성할 파일

| 파일 | 역할 | 줄 수 (추정) |
|------|------|-------------|
| `app/hooks/useExportImage.ts` | html-to-image 기반 내보내기 로직 훅 | ~120 |
| `app/components/ExportDialog.tsx` | Portal 기반 내보내기 옵션 모달 | ~180 |

### 수정할 파일

| 파일 | 변경 내용 | 변경량 |
|------|----------|--------|
| `app/components/GraphCanvas.tsx` | ExportDialog 상태 + 렌더링 추가 | ~15줄 추가 |
| `app/config/contextMenuItems.ts` | 내보내기 handler에 ExportDialog 연결 | ~10줄 수정 |

### 의존성 추가

| 패키지 | 버전 | 용도 |
|--------|------|------|
| `html-to-image` | `^1.11` | DOM → 이미지 변환 |

```bash
bun add html-to-image --cwd app
```

---

## 구현 단계

### Phase 4: useExportImage 훅

| 작업 | 파일 |
|------|------|
| `html-to-image` 의존성 설치 | `app/package.json` |
| `useExportImage` 훅 구현 | `app/hooks/useExportImage.ts` |
| PNG/JPG/SVG 각 포맷 내보내기 검증 | — |
| 클립보드 복사 기능 검증 | — |

**완료 기준**: `useExportImage` 훅이 전체 캔버스를 PNG/JPG/SVG로 내보내기하고, 클립보드에 PNG로 복사할 수 있음.

### Phase 5: ExportDialog UI

| 작업 | 파일 |
|------|------|
| ExportDialog 컴포넌트 구현 | `app/components/ExportDialog.tsx` |
| FormatSelector (라디오 버튼 그룹) 구현 | `app/components/ExportDialog.tsx` 내부 |
| SelectField (드롭다운) 구현 | `app/components/ExportDialog.tsx` 내부 |
| 미리보기 영역 구현 | `app/components/ExportDialog.tsx` |

**완료 기준**: 모달이 열리고 옵션 변경 → 다운로드/클립보드 복사가 동작함.

### Phase 6: Context Menu 연동

| 작업 | 파일 |
|------|------|
| GraphCanvas에 ExportDialog 상태 추가 | `app/components/GraphCanvas.tsx` |
| Context Menu handler에 ExportDialog 열기 콜백 연결 | `app/config/contextMenuItems.ts` |
| "PNG로 복사" 핸들러 → useExportImage.copyImageToClipboard 연결 | `app/config/contextMenuItems.ts` |
| 선택 영역 / 전체 영역 모드 전환 검증 | — |

**완료 기준**: Context Menu → 내보내기 → ExportDialog → 다운로드/복사 전체 플로우가 동작함.

---

## 엣지 케이스 처리

| 시나리오 | 처리 방식 |
|---------|----------|
| 노드가 없을 때 전체 내보내기 | 빈 캔버스 이미지 생성 (그리드만 포함) |
| 선택 항목 0개일 때 "선택 항목 내보내기" | `when` 조건으로 메뉴 아이템 숨김 |
| JPG + 투명 배경 | 흰색(`#FFFFFF`) 폴백 + UI에 안내 표시 |
| 매우 큰 캔버스 (노드 100+) | `scale: 1`로 자동 다운그레이드 + 경고 |
| 내보내기 중 파일 워치 업데이트 | `isExporting` 동안 그래프 업데이트 무시 |
| 브라우저 클립보드 API 미지원 | `copyImageToClipboard` 버튼 비활성화 + 툴팁 안내 |

---

## 전체 아키텍처 다이어그램

Context Tool Menu + Export Image 두 피쳐의 전체 관계를 나타냅니다.

```
┌─────────────────────────────────────────────────────────┐
│  GraphCanvas.tsx                                        │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ ReactFlow    │  │ useContext   │  │ useState      │  │
│  │ onNodeCtx    │──│ Menu()      │  │ exportDialog  │  │
│  │ onPaneCtx    │  │             │  │               │  │
│  └──────┬───────┘  └──────┬──────┘  └───────┬───────┘  │
│         │                 │                  │          │
│         │    openMenu()   │                  │          │
│         └────────────────►│                  │          │
│                           │                  │          │
│  ┌────────────────────────┼──────────────────┼────────┐ │
│  │ Portals (document.body)│                  │        │ │
│  │                        ▼                  ▼        │ │
│  │  ┌──────────────┐   ┌──────────────────┐          │ │
│  │  │ ContextMenu  │──►│ ExportDialog     │          │ │
│  │  │ z-[200]      │   │ z-[300]          │          │ │
│  │  └──────────────┘   │ ┌──────────────┐ │          │ │
│  │                      │ │useExportImage│ │          │ │
│  │                      │ │ toPng/toJpeg │ │          │ │
│  │                      │ │ toSvg/toBlob │ │          │ │
│  │                      │ └──────────────┘ │          │ │
│  │                      └──────────────────┘          │ │
│  └────────────────────────────────────────────────────┘ │
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │ contextMenuItems.ts (선언적 레지스트리)             │   │
│  │ ├── nodeMenuItems: PNG로 복사, 내보내기, 그룹 선택  │   │
│  │ └── paneMenuItems: 전체 내보내기, 화면에 맞추기     │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```
