import * as React from 'react';
import type { MarkdownSizeInput } from '../lib/size';
import type { FontFamilyPreset } from '../types/font';

export interface MarkdownProps {
    /** 마크다운 문자열 */
    children: string;
    /** 추가 스타일 (Tailwind CSS, prose 수정자 사용 가능) */
    className?: string;
    /** 폰트 프리셋 (global/canvas를 오버라이드) */
    fontFamily?: FontFamilyPreset;
    /** 스타일 프리셋. 기본값 'default' */
    variant?: 'default' | 'minimal';
    /** 단일 size 인터페이스 (primitive=1D, object=2D) */
    size?: MarkdownSizeInput;
    [key: string]: any;
}

/**
 * Markdown 컴포넌트
 * 
 * Node 내부에서 마크다운 텍스트를 렌더링합니다.
 * 기본 스타일은 흑백(prose-neutral)이며, className으로 커스터마이징 가능합니다.
 * 
 * @example
 * ```tsx
 * <Node id="intro">
 *   <Markdown>
 *     {`# 제목
 * 
 * 본문 텍스트입니다.
 * 
 * - 리스트 1
 * - 리스트 2`}
 *   </Markdown>
 * </Node>
 * ```
 */
export const Markdown: React.FC<MarkdownProps> = ({
    children,
    className,
    variant = 'default',
    ...rest
}) => {
    return React.createElement('graph-markdown', {
        content: children,
        className,
        variant,
        ...rest,
    });
};
