import { useCallback, useState } from 'react';
import { getNodesBounds, getViewportForBounds, Node, useReactFlow, useStoreApi } from 'reactflow';

export type ExportFormat = 'png' | 'jpg' | 'svg' | 'pdf';
export type ExportBackground = 'grid' | 'transparent' | 'solid';
export type ExportArea = 'selection' | 'full';

export interface ExportOptions {
  format: ExportFormat;
  background: ExportBackground;
  area: ExportArea;
  solidColor?: string;
  scale?: number;
}

interface NodeBoundsLike {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface TransformLike {
  x: number;
  y: number;
  zoom: number;
}

interface ExportReturn {
  /** 이미지 Blob/문자열 생성 */
  exportImage: (options: ExportOptions, nodeIds?: string[]) => Promise<Blob | string>;
  /** 파일로 다운로드 */
  downloadImage: (options: ExportOptions, filename?: string, nodeIds?: string[]) => Promise<void>;
  /** 클립보드에 PNG로 복사 */
  copyImageToClipboard: (
    nodeIds?: string[],
    overrides?: Partial<Pick<ExportOptions, 'background' | 'area' | 'solidColor' | 'scale'>>,
  ) => Promise<void>;
  /** 내보내기 진행 중 여부 */
  isExporting: boolean;
}

const MIN_CAPTURE_DIMENSION = 1;
const CAPTURE_PADDING = 16;
const DEFAULT_MEASURED_DIMENSION = 150;
const DEFAULT_SOLID_BACKGROUND = '#ffffff';
const GRID_BACKGROUND_COLOR = '#ffffff';
const GRID_LINE_COLOR = '#cbd5e1';
const GRID_GAP = 24;
const EXPORT_SELECTION_EFFECT_CLASSES = [
  'shadow-node-selected',
  'scale-105',
  'ring-1',
  'ring-2',
  'ring-brand-500/20',
  'ring-brand-500/50',
  'border-brand-500',
  'bg-brand-50/50',
  'drop-shadow-xl',
  'shadow-xl',
] as const;
const EXPORT_SELECTION_CLASS_PATTERNS = [
  /^selected$/,
  /^ring-/,
  /^border-brand-/,
  /^bg-brand-/,
  /^shadow-node-selected$/,
  /^drop-shadow-xl$/,
  /^scale-105$/,
  /^shadow-xl$/,
] as const;

let jsPdfModulePromise: Promise<typeof import('jspdf')> | null = null;
let htmlToImageModulePromise: Promise<typeof import('html-to-image')> | null = null;

async function loadJsPdf() {
  if (!jsPdfModulePromise) {
    jsPdfModulePromise = import('jspdf');
  }
  return jsPdfModulePromise;
}

async function loadHtmlToImage() {
  if (!htmlToImageModulePromise) {
    htmlToImageModulePromise = import('html-to-image');
  }
  return htmlToImageModulePromise;
}

type MeasuredExportNode = Node & {
  measured?: {
    width?: number;
    height?: number;
  };
};

function resolveBackgroundColor(options: ExportOptions): string | undefined {
  if (options.format === 'jpg' && options.background === 'transparent') {
    return options.solidColor ?? DEFAULT_SOLID_BACKGROUND;
  }

  if (options.background === 'solid') {
    return options.solidColor ?? DEFAULT_SOLID_BACKGROUND;
  }

  if (options.background === 'grid') {
    return GRID_BACKGROUND_COLOR;
  }

  if (options.background === 'transparent') {
    return 'transparent';
  }

  return undefined;
}

function resolveSelectionNodeIds(
  nodes: Node[],
  requestedNodeIds: string[] | undefined,
  area: ExportArea,
): string[] {
  if (area === 'full') {
    return nodes.map((node) => node.id);
  }

  const validIds = new Set(nodes.map((node) => node.id));
  const providedIds = requestedNodeIds
    ? requestedNodeIds.filter((id) => validIds.has(id))
    : [];

  if (providedIds.length > 0) {
    return providedIds;
  }

  return nodes.filter((node) => node.selected).map((node) => node.id);
}

function filterNodesByIds(nodes: Node[], nodeIds: string[]) {

  if (!nodeIds.length) {
    return [];
  }

  const nodeSet = new Set(nodeIds);
  return nodes.filter((node) => nodeSet.has(node.id));
}

function resolveNodeMeasurement(
  node: MeasuredExportNode,
  dimension: 'width' | 'height',
): number {
  const value = node[dimension];
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value;
  }

  const measuredValue = node.measured?.[dimension];
  if (typeof measuredValue === 'number' && Number.isFinite(measuredValue) && measuredValue > 0) {
    return measuredValue;
  }

  if (node.type === 'washi-tape') {
    const geometry = (node.data as {
      resolvedGeometry?: { length?: unknown; thickness?: unknown };
    } | undefined)?.resolvedGeometry;
    const geometryValue = dimension === 'width'
      ? geometry?.length
      : geometry?.thickness;

    if (typeof geometryValue === 'number' && Number.isFinite(geometryValue) && geometryValue > 0) {
      return geometryValue;
    }
  }

  return DEFAULT_MEASURED_DIMENSION;
}

function normalizeExportNodes(nodes: MeasuredExportNode[]): Node[] {
  return nodes.map((node) => ({
    ...node,
    width: resolveNodeMeasurement(node, 'width'),
    height: resolveNodeMeasurement(node, 'height'),
  }));
}

function addBoundsPadding(bounds: NodeBoundsLike, padding: number): NodeBoundsLike {
  return {
    x: bounds.x - padding,
    y: bounds.y - padding,
    width: bounds.width + padding * 2,
    height: bounds.height + padding * 2,
  };
}

function isClipboardApiAvailable(): boolean {
  return (
    typeof window !== 'undefined'
    && typeof window.navigator !== 'undefined'
    && typeof window.navigator.clipboard !== 'undefined'
    && typeof window.navigator.clipboard.write === 'function'
    && typeof (window as Window & { ClipboardItem?: typeof ClipboardItem }).ClipboardItem !== 'undefined'
  );
}

async function waitForFontsReady(): Promise<void> {
  if (typeof document === 'undefined') {
    return;
  }

  const fontsApi = document.fonts;
  if (!fontsApi || typeof fontsApi.ready === 'undefined') {
    return;
  }

  try {
    await fontsApi.ready;
  } catch {
    // Ignore font readiness failures; export should still proceed.
  }
}

function mergeBounds(bounds: NodeBoundsLike[]): NodeBoundsLike | null {
  if (bounds.length === 0) {
    return null;
  }

  const initial = bounds[0];
  const merged = bounds.slice(1).reduce(
    (acc, current) => {
      const minX = Math.min(acc.x, current.x);
      const minY = Math.min(acc.y, current.y);
      const maxX = Math.max(acc.x + acc.width, current.x + current.width);
      const maxY = Math.max(acc.y + acc.height, current.y + current.height);

      return {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
      };
    },
    initial,
  );

  return merged;
}

function escapeSelectorValue(value: string): string {
  if (typeof window !== 'undefined' && typeof window.CSS?.escape === 'function') {
    return window.CSS.escape(value);
  }

  return value.replace(/["\\]/g, '\\$&');
}

function resolveNodeBoundsFromDom(
  domRoot: HTMLElement,
  nodeIds: string[],
  transform: TransformLike,
): NodeBoundsLike | null {
  if (nodeIds.length === 0 || !Number.isFinite(transform.zoom) || transform.zoom === 0) {
    return null;
  }

  const canvasRect = domRoot.getBoundingClientRect();
  const bounds = nodeIds.flatMap((id) => {
    const escapedId = escapeSelectorValue(id);
    const nodeEl = domRoot.querySelector(`.react-flow__node[data-id="${escapedId}"]`) as HTMLElement | null;

    if (!nodeEl) {
      return [];
    }

    const rect = nodeEl.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return [];
    }

    const x = (rect.left - canvasRect.left - transform.x) / transform.zoom;
    const y = (rect.top - canvasRect.top - transform.y) / transform.zoom;
    const width = rect.width / transform.zoom;
    const height = rect.height / transform.zoom;

    return [{
      x,
      y,
      width,
      height,
    }];
  });

  return mergeBounds(bounds);
}

function buildBackgroundStyle(options: ExportOptions): Partial<CSSStyleDeclaration> {
  if (options.background === 'solid') {
    return {
      backgroundColor: options.solidColor ?? DEFAULT_SOLID_BACKGROUND,
      backgroundImage: 'none',
    };
  }

  if (options.background === 'grid') {
    return {
      backgroundColor: GRID_BACKGROUND_COLOR,
      backgroundImage: [
        `linear-gradient(to right, ${GRID_LINE_COLOR} 1px, transparent 1px)`,
        `linear-gradient(to bottom, ${GRID_LINE_COLOR} 1px, transparent 1px)`,
      ].join(','),
      backgroundSize: `${GRID_GAP}px ${GRID_GAP}px`,
      backgroundRepeat: 'repeat',
      backgroundPosition: '0 0',
    };
  }

  return {
    backgroundColor: 'transparent',
    backgroundImage: 'none',
  };
}

function shouldStripSelectionClass(className: string): boolean {
  return (
    EXPORT_SELECTION_EFFECT_CLASSES.some((token) => token === className)
    || EXPORT_SELECTION_CLASS_PATTERNS.some((pattern) => pattern.test(className))
  );
}

function stripSelectionStylesForCapture(root: HTMLElement, nodeIds: string[]): () => void {
  const originalClassNames = new Map<Element, string>();
  const hiddenOverlayElements: Array<{ element: HTMLElement; display: string }> = [];
  const targetNodeIds = nodeIds.length > 0
    ? nodeIds
    : Array.from(root.querySelectorAll('.react-flow__node.selected'))
      .map((element) => element.getAttribute('data-id'))
      .filter((id): id is string => Boolean(id));

  targetNodeIds.forEach((id) => {
    const escapedId = escapeSelectorValue(id);
    const nodeElement = root.querySelector(`.react-flow__node[data-id="${escapedId}"]`) as HTMLElement | null;
    if (!nodeElement) {
      return;
    }

    const candidates = [nodeElement, ...Array.from(nodeElement.querySelectorAll('*'))];
    candidates.forEach((element) => {
      const original = element.getAttribute('class');
      if (!original) {
        return;
      }

      const cleaned = original
        .split(/\s+/)
        .filter((token) => token && !shouldStripSelectionClass(token))
        .join(' ');

      if (cleaned !== original) {
        originalClassNames.set(element, original);
        if (cleaned) {
          element.setAttribute('class', cleaned);
        } else {
          element.removeAttribute('class');
        }
      }
    });
  });

  const overlays = root.querySelectorAll('.react-flow__selection, .react-flow__nodesselection-rect');
  overlays.forEach((overlay) => {
    const element = overlay as HTMLElement;
    hiddenOverlayElements.push({ element, display: element.style.display });
    element.style.display = 'none';
  });

  return () => {
    originalClassNames.forEach((className, element) => {
      element.setAttribute('class', className);
    });

    hiddenOverlayElements.forEach(({ element, display }) => {
      element.style.display = display;
    });
  };
}

export function useExportImage(): ExportReturn {
  const [isExporting, setIsExporting] = useState(false);
  const { getNodes } = useReactFlow();
  const storeApi = useStoreApi();

  const exportImage = useCallback(async (options: ExportOptions, nodeIds?: string[]): Promise<Blob | string> => {
    if (typeof window === 'undefined') {
      throw new Error('브라우저 환경에서만 내보내기 기능을 사용할 수 있습니다.');
    }

    const flowState = storeApi.getState();
    const [currentX, currentY, currentZoom] = flowState.transform ?? [0, 0, 1];
    const minZoom = typeof flowState.minZoom === 'number' ? flowState.minZoom : 0.1;
    const maxZoom = typeof flowState.maxZoom === 'number' ? flowState.maxZoom : 2;
    const flowDomNode = flowState.domNode as HTMLElement | null;
    const graphNodes = getNodes();
    const viewport = flowDomNode?.querySelector('.react-flow__viewport') as HTMLElement | null;
    const fallbackViewport = graphNodes.length > 0
      ? document.querySelector('.react-flow__viewport') as HTMLElement | null
      : null;
    const captureTarget = viewport ?? fallbackViewport;
    const captureRoot = flowDomNode ?? document.querySelector('.react-flow') as HTMLElement | null;

    if (!captureTarget || !captureRoot) {
      throw new Error('내보내기 대상 뷰포트를 찾지 못했습니다.');
    }

    const selectionIds = resolveSelectionNodeIds(graphNodes, nodeIds, options.area);
    const targetNodes = options.area === 'selection'
      ? filterNodesByIds(graphNodes, selectionIds)
      : graphNodes;

    const exportNodes = normalizeExportNodes(targetNodes as MeasuredExportNode[]);

    if (options.area === 'selection' && !exportNodes.length) {
      throw new Error('내보내기 대상이 없습니다.');
    }

    const baseScale = options.scale
      ?? (graphNodes.length >= 120 ? 1 : 2);

    let captureWidth = Math.max(MIN_CAPTURE_DIMENSION, Math.ceil(captureTarget.clientWidth));
    let captureHeight = Math.max(MIN_CAPTURE_DIMENSION, Math.ceil(captureTarget.clientHeight));
    let viewportTransform = { x: 0, y: 0, zoom: 1 };
    if (exportNodes.length > 0) {
      const domBounds = options.area === 'selection'
        ? resolveNodeBoundsFromDom(captureRoot, selectionIds, {
          x: currentX,
          y: currentY,
          zoom: currentZoom,
        })
        : null;
      const bounds = domBounds ?? getNodesBounds(exportNodes);
      const paddedBounds = options.area === 'selection'
        ? addBoundsPadding(bounds, CAPTURE_PADDING)
        : bounds;
      const effectiveBounds = options.area === 'selection'
        ? paddedBounds
        : bounds;
      const width = options.area === 'selection'
        ? effectiveBounds.width
        : Math.max(bounds.width, captureTarget.clientWidth);
      const height = options.area === 'selection'
        ? effectiveBounds.height
        : Math.max(bounds.height, captureTarget.clientHeight);
      captureWidth = Math.max(MIN_CAPTURE_DIMENSION, Math.ceil(width));
      captureHeight = Math.max(MIN_CAPTURE_DIMENSION, Math.ceil(height));
      viewportTransform = getViewportForBounds(
        effectiveBounds,
        captureWidth,
        captureHeight,
        minZoom,
        maxZoom,
      );

      if (!Number.isFinite(viewportTransform.x) || !Number.isFinite(viewportTransform.y) || !Number.isFinite(viewportTransform.zoom)) {
        throw new Error('캡처 영역 계산에 실패했습니다.');
      }
    } else if (options.area === 'full') {
      // full area without nodes: fallback to current viewport
      captureWidth = Math.max(MIN_CAPTURE_DIMENSION, Math.ceil(captureTarget.clientWidth));
      captureHeight = Math.max(MIN_CAPTURE_DIMENSION, Math.ceil(captureTarget.clientHeight));
      viewportTransform = { x: 0, y: 0, zoom: 1 };
    }

    const captureOptions = {
      backgroundColor: resolveBackgroundColor(options),
      width: captureWidth,
      height: captureHeight,
      canvasWidth: captureWidth,
      canvasHeight: captureHeight,
      pixelRatio: baseScale,
      style: {
        ...buildBackgroundStyle(options),
        transform: `translate(${viewportTransform.x}px, ${viewportTransform.y}px) scale(${viewportTransform.zoom})`,
        transformOrigin: 'top left',
      },
      filter: (domNode: HTMLElement) => !domNode.classList?.contains('react-flow__selection'),
      cacheBust: true,
      skipAutoScale: true,
    } as const;

    const selectedNodeIds = graphNodes
      .filter((node) => node.selected)
      .map((node) => node.id);
    const restoreSelectionStyles = stripSelectionStylesForCapture(captureRoot, selectedNodeIds);

    try {
      await waitForFontsReady();
      const { toPng, toJpeg, toSvg } = await loadHtmlToImage();

      if (options.format === 'png') {
        return await toPng(captureTarget, captureOptions);
      }

      if (options.format === 'jpg') {
        const jpegOptions = {
          ...captureOptions,
          backgroundColor: resolveBackgroundColor({
            ...options,
            background: options.background === 'transparent' ? 'solid' : options.background,
          }),
        };
        return await toJpeg(captureTarget, jpegOptions);
      }

      if (options.format === 'svg') {
        return await toSvg(captureTarget, captureOptions);
      }

      const pngDataUrl = await toPng(captureTarget, captureOptions);
      const { jsPDF } = await loadJsPdf();
      const orientation = captureWidth >= captureHeight ? 'landscape' : 'portrait';
      const pdf = new jsPDF({
        orientation,
        unit: 'px',
        format: [captureWidth, captureHeight],
      });
      pdf.addImage(pngDataUrl, 'PNG', 0, 0, captureWidth, captureHeight, undefined, 'FAST');
      return pdf.output('blob');
    } finally {
      restoreSelectionStyles();
    }
  }, [getNodes, storeApi]);

  const copyImageToClipboard = useCallback(async (
    nodeIds?: string[],
    overrides?: Partial<Pick<ExportOptions, 'background' | 'area' | 'solidColor' | 'scale'>>,
  ) => {
    if (!isClipboardApiAvailable()) {
      throw new Error('이 브라우저에서는 클립보드 이미지 복사를 지원하지 않습니다.');
    }

    const graphNodes = getNodes();
    const requestedArea = overrides?.area;
    const selectedIds = resolveSelectionNodeIds(graphNodes, nodeIds, 'selection');
    const hasSelection = selectedIds.length > 0;
    const area = requestedArea ?? (hasSelection ? 'selection' : 'full');
    const exportNodeIds = area === 'selection' ? selectedIds : undefined;
    const options: ExportOptions = {
      format: 'png',
      background: overrides?.background ?? 'transparent',
      area,
      solidColor: overrides?.solidColor,
      scale: overrides?.scale,
    };

    const image = await exportImage(options, exportNodeIds);
    const blob = image instanceof Blob
      ? image
      : await (await fetch(image)).blob();

    const item = new ClipboardItem({
      'image/png': blob,
    });
    await navigator.clipboard.write([item]);
  }, [exportImage, getNodes]);

  const downloadImage = useCallback(async (
    options: ExportOptions,
    filename?: string,
    nodeIds?: string[],
  ): Promise<void> => {
    const image = await exportImage(options, nodeIds);

    const blob = image instanceof Blob
      ? image
      : await (await fetch(image)).blob();

    const ext = options.format === 'jpg' ? 'jpg' : options.format;
    const safeName = filename
      ? filename.endsWith(`.${ext}`)
        ? filename
        : `${filename}.${ext}`
      : `magam-export-${Date.now()}.${ext}`;

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');

    a.href = url;
    a.download = safeName;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [exportImage]);

  const withExportState = useCallback(
    <T,>(operation: () => Promise<T>): Promise<T> => {
      setIsExporting(true);
      return operation().finally(() => {
        setIsExporting(false);
      });
    },
    [],
  );

  return {
    exportImage: (options, nodeIds) => withExportState(() => exportImage(options, nodeIds)),
    downloadImage: (options, filename, nodeIds) => withExportState(() => downloadImage(options, filename, nodeIds)),
    copyImageToClipboard: (nodeIds, overrides) => withExportState(() => copyImageToClipboard(nodeIds, overrides)),
    isExporting,
  };
}
