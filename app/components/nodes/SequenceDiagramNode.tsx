import React, { memo, useEffect } from 'react';
import { NodeProps } from 'reactflow';
import { BaseNode } from './BaseNode';
import { useGraphStore } from '@/store/graph';
import type { FontFamilyPreset } from '@magam/core';
import {
  resolveFontFamilyCssValue,
} from '@/utils/fontHierarchy';
import { emitSizeWarning } from '@/utils/sizeWarnings';

interface ParticipantData {
  id: string;
  label: string;
  className?: string;
}

interface MessageData {
  from: string;
  to: string;
  label?: string;
  type: 'sync' | 'async' | 'reply' | 'self';
}

interface SequenceDiagramData {
  participants: ParticipantData[];
  messages: MessageData[];
  participantSpacing: number;
  messageSpacing: number;
  className?: string;
  fontFamily?: FontFamilyPreset;
}

const PARTICIPANT_WIDTH = 150;
const PARTICIPANT_HEIGHT = 50;
const ARROW_SIZE = 8;
const SELF_LOOP_WIDTH = 30;
const SELF_LOOP_HEIGHT = 30;

const SequenceDiagramNode = ({ data, selected }: NodeProps<SequenceDiagramData>) => {
  const { participants, messages, participantSpacing, messageSpacing } = data;
  const globalFontFamily = useGraphStore((state) => state.globalFontFamily);
  const canvasFontFamily = useGraphStore((state) => state.canvasFontFamily);
  const resolvedFontFamily = resolveFontFamilyCssValue({
    nodeFontFamily: data.fontFamily,
    canvasFontFamily,
    globalFontFamily,
  });
  useEffect(() => {
    const sizeInput = (data as { size?: unknown }).size;
    if (sizeInput === undefined) return;
    emitSizeWarning({
      code: 'UNSUPPORTED_LEGACY_SIZE_API',
      component: 'SequenceDiagramNode',
      inputPath: 'size',
      fallbackApplied: 'ignored legacy input',
    });
  }, [(data as { size?: unknown }).size]);

  if (participants.length === 0) return null;

  // Build participant index map
  const participantIndex = new Map<string, number>();
  participants.forEach((p, i) => {
    participantIndex.set(p.id, i);
  });

  // Calculate dimensions
  const totalWidth = (participants.length - 1) * participantSpacing + PARTICIPANT_WIDTH;
  const lifelineHeight = (messages.length + 1) * messageSpacing;
  const totalHeight = PARTICIPANT_HEIGHT + lifelineHeight + PARTICIPANT_HEIGHT;

  return (
    <BaseNode
      selected={selected}
      startHandle={false}
      endHandle={false}
      style={{ width: totalWidth, height: totalHeight }}
    >
      <div style={{ position: 'relative', width: totalWidth, height: totalHeight }}>
      {/* Participant top boxes + lifelines + bottom boxes */}
      {participants.map((p, i) => {
        const x = i * participantSpacing;
        const centerX = x + PARTICIPANT_WIDTH / 2;

        return (
          <React.Fragment key={p.id}>
            {/* Top box */}
            <div
              className="flex items-center justify-center rounded-md bg-card shadow-raised shadow-[inset_0_0_0_1px_rgb(var(--color-border)/0.18)]"
              style={{
                position: 'absolute',
                left: x,
                top: 0,
                width: PARTICIPANT_WIDTH,
                height: PARTICIPANT_HEIGHT,
              }}
            >
              <span
                className="select-none text-sm font-semibold text-foreground/82"
                style={{ fontFamily: resolvedFontFamily }}
              >
                {p.label}
              </span>
            </div>

            {/* Lifeline */}
            <div
              style={{
                position: 'absolute',
                left: centerX,
                top: PARTICIPANT_HEIGHT,
                width: 0,
                height: lifelineHeight,
                borderLeft: '2px dashed rgb(var(--color-border) / 0.6)',
              }}
            />

            {/* Bottom box */}
            <div
              className="flex items-center justify-center rounded-md bg-card shadow-raised shadow-[inset_0_0_0_1px_rgb(var(--color-border)/0.18)]"
              style={{
                position: 'absolute',
                left: x,
                top: PARTICIPANT_HEIGHT + lifelineHeight,
                width: PARTICIPANT_WIDTH,
                height: PARTICIPANT_HEIGHT,
              }}
            >
              <span
                className="select-none text-sm font-semibold text-foreground/82"
                style={{ fontFamily: resolvedFontFamily }}
              >
                {p.label}
              </span>
            </div>
          </React.Fragment>
        );
      })}

      {/* Messages */}
      {messages.map((msg, msgIndex) => {
        const msgY = PARTICIPANT_HEIGHT + (msgIndex + 1) * messageSpacing;
        const fromCol = participantIndex.get(msg.from) ?? 0;
        const toCol = participantIndex.get(msg.to) ?? 0;

        if (msg.type === 'self') {
          return (
            <SelfMessageArrow
              key={`msg-${msgIndex}`}
              x={fromCol * participantSpacing + PARTICIPANT_WIDTH / 2}
              y={msgY}
              label={msg.label}
              messageType={msg.type}
              fontFamily={resolvedFontFamily}
            />
          );
        }

        const fromX = fromCol * participantSpacing + PARTICIPANT_WIDTH / 2;
        const toX = toCol * participantSpacing + PARTICIPANT_WIDTH / 2;

        return (
          <MessageArrow
            key={`msg-${msgIndex}`}
            fromX={fromX}
            toX={toX}
            y={msgY}
            label={msg.label}
            messageType={msg.type}
            fontFamily={resolvedFontFamily}
          />
        );
      })}
      </div>
    </BaseNode>
  );
};

/** Regular horizontal message arrow */
function MessageArrow({
  fromX,
  toX,
  y,
  label,
  messageType,
  fontFamily,
}: {
  fromX: number;
  toX: number;
  y: number;
  label?: string;
  messageType: string;
  fontFamily?: string;
}) {
  const leftX = Math.min(fromX, toX);
  const width = Math.abs(toX - fromX);
  const isLeftToRight = toX > fromX;
  const isDashed = messageType === 'reply';
  const isFilled = messageType === 'sync';

  const svgHeight = 40;
  const arrowY = svgHeight / 2;

  return (
    <div style={{ position: 'absolute', left: leftX, top: y - svgHeight / 2 }}>
      <svg
        width={width}
        height={svgHeight}
        viewBox={`0 0 ${width} ${svgHeight}`}
        style={{ overflow: 'visible' }}
      >
        {/* Arrow line */}
        <line
          x1={isLeftToRight ? 0 : width}
          y1={arrowY}
          x2={isLeftToRight ? width - ARROW_SIZE : ARROW_SIZE}
          y2={arrowY}
          stroke="rgb(var(--color-foreground) / 0.72)"
          strokeWidth={1.5}
          strokeDasharray={isDashed ? '6 4' : undefined}
        />

        {/* Arrowhead */}
        {isFilled ? (
          <polygon
            points={
              isLeftToRight
                ? `${width},${arrowY} ${width - ARROW_SIZE},${arrowY - ARROW_SIZE / 2} ${width - ARROW_SIZE},${arrowY + ARROW_SIZE / 2}`
                : `0,${arrowY} ${ARROW_SIZE},${arrowY - ARROW_SIZE / 2} ${ARROW_SIZE},${arrowY + ARROW_SIZE / 2}`
            }
            fill="rgb(var(--color-foreground) / 0.72)"
          />
        ) : (
          <polyline
            points={
              isLeftToRight
                ? `${width - ARROW_SIZE},${arrowY - ARROW_SIZE / 2} ${width},${arrowY} ${width - ARROW_SIZE},${arrowY + ARROW_SIZE / 2}`
                : `${ARROW_SIZE},${arrowY - ARROW_SIZE / 2} 0,${arrowY} ${ARROW_SIZE},${arrowY + ARROW_SIZE / 2}`
            }
            fill="none"
            stroke="rgb(var(--color-foreground) / 0.72)"
            strokeWidth={1.5}
          />
        )}

        {/* Label above the arrow */}
        {label && (
          <text
            x={width / 2}
            y={arrowY - 8}
            textAnchor="middle"
            fill="rgb(var(--color-foreground) / 0.72)"
            fontSize={12}
            fontFamily={fontFamily}
          >
            {label}
          </text>
        )}
      </svg>
    </div>
  );
}

/** Self-message: loopback arrow on the same participant's lifeline */
function SelfMessageArrow({
  x,
  y,
  label,
  messageType,
  fontFamily,
}: {
  x: number;
  y: number;
  label?: string;
  messageType: string;
  fontFamily?: string;
}) {
  const width = SELF_LOOP_WIDTH * 2 + 20;
  const height = SELF_LOOP_HEIGHT + 30;
  const isDashed = messageType === 'reply';

  return (
    <div style={{ position: 'absolute', left: x, top: y - 10 }}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ overflow: 'visible' }}
      >
        {/* Loopback path: right, down, left */}
        <path
          d={`M 0,10 H ${SELF_LOOP_WIDTH + 10} V ${SELF_LOOP_HEIGHT + 10} H ${ARROW_SIZE}`}
          fill="none"
          stroke="rgb(var(--color-foreground) / 0.72)"
          strokeWidth={1.5}
          strokeDasharray={isDashed ? '6 4' : undefined}
        />

        {/* Arrowhead pointing left at bottom */}
        <polygon
          points={`0,${SELF_LOOP_HEIGHT + 10} ${ARROW_SIZE},${SELF_LOOP_HEIGHT + 10 - ARROW_SIZE / 2} ${ARROW_SIZE},${SELF_LOOP_HEIGHT + 10 + ARROW_SIZE / 2}`}
          fill="rgb(var(--color-foreground) / 0.72)"
        />

        {/* Label */}
        {label && (
          <text
            x={SELF_LOOP_WIDTH / 2 + 12}
            y={6}
            textAnchor="middle"
            fill="rgb(var(--color-foreground) / 0.72)"
            fontSize={12}
            fontFamily={fontFamily}
          >
            {label}
          </text>
        )}
      </svg>
    </div>
  );
}

export default memo(SequenceDiagramNode);
