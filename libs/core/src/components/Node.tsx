import * as React from 'react';
import type { FontFamilyPreset } from '../types/font';

export type EdgeLabelStyle = {
  text?: string;
  color?: string;
  bg?: string;
  fontSize?: number;
};

export type EdgeStyle = {
  label?: string | EdgeLabelStyle;
  stroke?: string;
  strokeWidth?: number;
  pattern?: 'dashed' | 'dotted' | string;
  className?: string;
  type?: 'default' | 'straight' | 'curved' | 'step' | string;
};

export type FromProp =
  | string
  | {
      node: string;
      edge?: EdgeStyle;
    };

export interface NodeProps {
  /** 필수: 노드의 고유 식별자 */
  id: string;
  /** 부모(또는 연결 대상) 노드 선언. string 또는 { node, edge } */
  from?: FromProp;
  /** from 연결선에 표시할 라벨 텍스트 */
  edgeLabel?: string;
  /** 연결선 스타일 (dashed, dotted 등) */
  edgeClassName?: 'dashed' | 'dotted' | string;
  /** 노드 스타일 (Tailwind CSS) */
  className?: string;
  /** 노드 폰트 프리셋 (global/canvas를 오버라이드) */
  fontFamily?: FontFamilyPreset;
  /** 
   * 텍스트, <Text>, 또는 여러 요소의 조합. 빈 노드는 허용되지 않습니다.
   * 여러 Text 컴포넌트를 중첩하여 제목/설명 구조를 만들 수 있습니다.
   */
  children: React.ReactNode;
  // 내부용 (레이아웃 엔진에서 주입)
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  [key: string]: any;
}

export const Node: React.FC<NodeProps> = (props) => {
  return React.createElement('graph-node', props, props.children);
};
