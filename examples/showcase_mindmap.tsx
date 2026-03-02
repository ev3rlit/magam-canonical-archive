import { Canvas, MindMap, Node, Markdown, Text } from '@magam/core';

/**
 * 마인드맵 레이아웃 쇼케이스
 *
 * MindMap 컴포넌트의 다양한 레이아웃과 계층 구조를 보여줍니다.
 */
export default function ShowcaseMindmap() {
    return (
        <Canvas>
            <Text id="showcase-mindmap-map.seed" x={0} y={0} className="text-[1px] text-transparent select-none">.</Text>
            <MindMap id="showcase-mindmap-map" layout="bidirectional">
                {/* Root */}
                <Node
                    id="root"
                    bubble
                    from={{ node: 'showcase-mindmap-map.seed', edge: { stroke: 'transparent', strokeWidth: 0 } }}
                >
                    <Markdown>{`# MindMap 컴포넌트

> 계층 구조를 자동으로 배치합니다`}</Markdown>
                </Node>

                {/* Level 1: 레이아웃 */}
                <Node id="layout" from="root" bubble>
                    <Markdown>{`### 레이아웃 옵션

\`layout\` prop으로 배치 방향 선택`}</Markdown>
                </Node>

                <Node id="content" from="root" bubble>
                    <Markdown>{`### 콘텐츠 유형

Node 안에 다양한 콘텐츠 배치`}</Markdown>
                </Node>

                <Node id="structure" from="root" bubble>
                    <Markdown>{`### 구조 기능

\`from\` prop으로 부모-자식 연결`}</Markdown>
                </Node>

                <Node id="interaction" from="root" bubble>
                    <Markdown>{`### 인터랙션

줌 레벨에 따른 시맨틱 뷰`}</Markdown>
                </Node>

                {/* Level 2: 레이아웃 상세 */}
                <Node id="layout-tree" from="layout">
                    <Markdown>{`**tree** — 단방향 트리
왼쪽에서 오른쪽으로 확장`}</Markdown>
                </Node>

                <Node id="layout-bidi" from="layout">
                    <Markdown>{`**bidirectional** — 양방향
루트 기준 좌우로 분배`}</Markdown>
                </Node>

                <Node id="layout-radial" from="layout">
                    <Markdown>{`**radial** — 방사형
루트를 중심으로 원형 배치`}</Markdown>
                </Node>

                {/* Level 2: 콘텐츠 상세 */}
                <Node id="content-text" from="content">
                    <Markdown>{`일반 텍스트
\`<Node>텍스트</Node>\``}</Markdown>
                </Node>

                <Node id="content-md" from="content">
                    <Markdown>{`**마크다운** 지원
테이블 · 코드 · 목록 · 인용`}</Markdown>
                </Node>

                <Node id="content-styled" from="content" className="bg-blue-50 border-blue-300 text-blue-700">
                    <Markdown>{`Tailwind 스타일링
\`className\` prop 적용`}</Markdown>
                </Node>

                {/* Level 2: 구조 상세 */}
                <Node id="structure-from" from="structure">
                    <Markdown>{`\`from="parentId"\`
자동으로 Edge 생성`}</Markdown>
                </Node>

                <Node id="structure-multi" from="structure">
                    <Markdown>{`다중 MindMap
Canvas 위에 독립 배치 가능`}</Markdown>
                </Node>

                {/* Level 2: 인터랙션 상세 */}
                <Node id="interaction-bubble" from="interaction">
                    <Markdown>{`\`bubble\` prop 활성화 시
줌 아웃해도 라벨 표시`}</Markdown>
                </Node>

                <Node id="interaction-link" from="interaction">
                    <Markdown>{`\`node:/mapId/nodeId\` 링크로
노드 간 내비게이션`}</Markdown>
                </Node>
            </MindMap>
        </Canvas>
    );
}
