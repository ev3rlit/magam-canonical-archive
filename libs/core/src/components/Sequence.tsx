import * as React from 'react';
import { useNodeId } from '../hooks/useNodeId';
import type { FromProp } from './Node';

export interface SequenceProps {
  /** Sequence 식별자 */
  id?: string;
  /** MindMap 계층 연결 (string 또는 { node, edge }) */
  from?: FromProp;
  /** X 좌표 (px) - anchor 사용 시 선택적 */
  x?: number;
  /** Y 좌표 (px) - anchor 사용 시 선택적 */
  y?: number;
  /** Anchor-based positioning */
  anchor?: string;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  gap?: number;
  align?: 'start' | 'center' | 'end';
  /** 참여자 간 수평 간격 (px). default 200 */
  participantSpacing?: number;
  /** 메시지 간 수직 간격 (px). default 60 */
  messageSpacing?: number;
  /** 컨테이너 스타일 (Tailwind CSS) */
  className?: string;
  /** Sequence 내부의 Participant, Message 컴포넌트들 */
  children?: React.ReactNode;
  [key: string]: any;
}

export const Sequence: React.FC<SequenceProps> = ({
  id,
  x,
  y,
  anchor,
  position,
  gap,
  align,
  participantSpacing = 200,
  messageSpacing = 60,
  ...rest
}) => {
  const scopedId = useNodeId(id);
  return React.createElement('graph-sequence', {
    id: scopedId,
    x,
    y,
    anchor,
    position,
    gap,
    align,
    participantSpacing,
    messageSpacing,
    ...rest,
  });
};
