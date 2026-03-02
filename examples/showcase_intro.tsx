import { Canvas, MindMap, Node, Markdown, Text } from '@magam/core';

/**
 * Magam 소개 — 포트폴리오 썸네일용
 *
 * 양방향 마인드맵으로 Magam의 핵심 가치를 한눈에 보여줍니다.
 */
export default function ShowcaseIntro() {
    return (
        <Canvas>
            <Text id="showcase-intro-map.seed" x={0} y={0} className="text-[1px] text-transparent select-none">.</Text>
            <MindMap id="showcase-intro-map" layout="bidirectional">
                {/* Root */}
                <Node
                    id="root"
                    bubble
                    from={{ node: 'showcase-intro-map.seed', edge: { stroke: 'transparent', strokeWidth: 0 } }}
                >
                    <Markdown>{`# Magam

> 코드로 그리는 화이트보드`}</Markdown>
                </Node>

                {/* Level 1 — 왼쪽 */}
                <Node id="ai" from="root">
                    <Markdown>{`### AI-Native

자연어로 설명하면 AI가 코드를 작성`}</Markdown>
                </Node>

                <Node id="code" from="root">
                    <Markdown>{`### 코드 기반 시각화

TSX 코드가 곧 다이어그램`}</Markdown>
                </Node>

                {/* Level 1 — 오른쪽 */}
                <Node id="sync" from="root">
                    <Markdown>{`### 실시간 동기화

파일 저장 즉시 캔버스에 반영`}</Markdown>
                </Node>

                <Node id="react" from="root">
                    <Markdown>{`### 리액트 컴포넌트

익숙한 React/JSX 문법 그대로`}</Markdown>
                </Node>

                {/* Level 2 */}
                <Node id="ai-detail" from="ai">
                    <Markdown>{`자연어 → TSX → 캔버스
한 문장이면 다이어그램 완성`}</Markdown>
                </Node>

                <Node id="code-detail" from="code">
                    <Markdown>{`Git 버전관리 · 재사용 · 자동화
코드로 관리하는 시각 자산`}</Markdown>
                </Node>

                <Node id="sync-detail" from="sync">
                    <Markdown>{`WebSocket 라이브 리로드
편집과 동시에 결과 확인`}</Markdown>
                </Node>

                <Node id="react-detail" from="react">
                    <Markdown>{`Tailwind 스타일링 지원
컴포넌트 조합으로 무한 확장`}</Markdown>
                </Node>
            </MindMap>
        </Canvas>
    );
}
