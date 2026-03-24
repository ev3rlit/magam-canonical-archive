import React, { memo, useMemo, useState } from 'react';
import { NodeProps } from 'reactflow';
import { BaseNode } from './BaseNode';
import { toAssetApiUrl } from '@/utils/imageSource';
import { useGraphStore } from '@/store/graph';

interface ImageNodeData {
  src?: string;
  alt?: string;
  width?: number | string;
  height?: number;
  fit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
  className?: string;
}

const IMAGE_FIT_MAP: Record<NonNullable<ImageNodeData['fit']>, string> = {
  cover: 'object-cover',
  contain: 'object-contain',
  fill: 'object-fill',
  none: 'object-none',
  'scale-down': 'object-scale-down',
};

const ImageNode = ({ data, selected }: NodeProps<ImageNodeData>) => {
  const currentFile = useGraphStore((state) => state.currentFile);
  const [loadError, setLoadError] = useState(false);

  const src = useMemo(() => {
    if (!data.src) {
      return '';
    }
    return toAssetApiUrl(currentFile, data.src);
  }, [currentFile, data.src]);

  const objectFit = useMemo(
    () => (data.fit ? IMAGE_FIT_MAP[data.fit] : 'object-contain'),
    [data.fit],
  );

  if (!src) {
    return (
      <BaseNode className="rounded-lg bg-card px-3 py-2 shadow-[inset_0_0_0_1px_rgb(var(--color-danger)/0.18)]" selected={selected}>
        <div className="text-xs text-danger">이미지 경로가 없습니다.</div>
      </BaseNode>
    );
  }

  return (
    <BaseNode
      className="rounded-xl bg-card p-2 shadow-raised shadow-[inset_0_0_0_1px_rgb(var(--color-border)/0.14)]"
      selected={selected}
      startHandle={false}
      endHandle={false}
    >
      {!loadError ? (
        <img
          src={src}
          alt={data.alt || ''}
          style={{
            width: data.width ?? '100%',
            height: data.height ?? 'auto',
          }}
          className={`max-w-full ${objectFit}`}
          onError={() => setLoadError(true)}
        />
      ) : (
        <div className="flex h-24 w-48 items-center justify-center rounded-lg bg-muted text-xs text-foreground/52 shadow-[inset_0_0_0_1px_rgb(var(--color-border)/0.12)]">
          이미지 로드 실패
        </div>
      )}
    </BaseNode>
  );
};

export default memo(ImageNode);
