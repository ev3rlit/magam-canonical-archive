import * as React from 'react';
import { MindMapContext } from '../context/MindMapContext';
import { useNodeId } from '../hooks/useNodeId';

export interface MindMapProps {
  /** MindMap 식별자 (다중 MindMap 시 필수) */
  id?: string;
  /** X 좌표 (px) - anchor 사용 시 선택적 */
  x?: number;
  /** Y 좌표 (px) - anchor 사용 시 선택적 */
  y?: number;
  /** Anchor-based positioning (alternative to x/y) */
  anchor?: string;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  gap?: number;
  align?: 'start' | 'center' | 'end';
  /** 레이아웃 알고리즘. 기본값 'compact' */
  layout?: 'tree' | 'bidirectional' | 'radial' | 'compact' | 'compact-bidir' | 'depth-hybrid' | 'treemap-pack' | 'quadrant-pack' | 'voronoi-pack';
  /** 노드 간 간격 (px). 기본값 50 */
  spacing?: number;
  /** quadrant-pack 서브트리 배치 밀도 (0~1). 기본값 0.5 */
  density?: number;
  /** 컨테이너 스타일 (Tailwind CSS) */
  className?: string;
  /** MindMap 내부의 Node 컴포넌트들 */
  children?: React.ReactNode;
  [key: string]: any;
}

export const MindMap: React.FC<MindMapProps> = ({
  id,
  x,
  y,
  anchor,
  position,
  gap,
  align,
  layout = 'compact',
  spacing = 50,
  children,
  ...rest
}) => {
  const scopedId = useNodeId(id);
  return React.createElement(
    MindMapContext.Provider,
    { value: true },
    React.createElement('graph-mindmap', {
      id: scopedId,
      x,
      y,
      anchor,
      position,
      gap,
      align,
      layout,
      spacing,
      ...rest,
    }, children),
  );
};
