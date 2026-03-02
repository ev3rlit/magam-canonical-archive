import { Canvas, MindMap, Node, Markdown, Text } from '@magam/core';

/**
 * Tailwind 스타일링 쇼케이스
 *
 * AI에게 스타일을 요청하면 Tailwind className이 적용되는 워크플로우를 보여줍니다.
 */
export default function ShowcaseStyling() {
    return (
        <Canvas>
            <Text id="showcase-styling-map.seed" x={0} y={0} className="text-[1px] text-transparent select-none">.</Text>
            <MindMap id="showcase-styling-map" layout="bidirectional">
                {/* Root */}
                <Node
                    id="root"
                    bubble
                    from={{ node: 'showcase-styling-map.seed', edge: { stroke: 'transparent', strokeWidth: 0 } }}
                >
                    <Markdown>{`# Tailwind 스타일링

> className 한 줄이면
> 어떤 스타일이든 적용됩니다`}</Markdown>
                </Node>

                {/* Level 1: 프롬프트 */}
                <Node id="prompt-status" from="root">
                    <Markdown>{`**"상태별 색상을 구분해줘"**`}</Markdown>
                </Node>

                <Node id="prompt-effect" from="root">
                    <Markdown>{`**"그라디언트랑 그림자 효과 넣어줘"**`}</Markdown>
                </Node>

                <Node id="prompt-border" from="root">
                    <Markdown>{`**"테두리 스타일 다양하게 해줘"**`}</Markdown>
                </Node>

                <Node id="prompt-glass" from="root">
                    <Markdown>{`**"글래스모피즘 느낌으로 만들어줘"**`}</Markdown>
                </Node>

                {/* Level 2: AI가 생성한 결과물 — 실제 스타일 적용 */}
                <Node id="result-success" from="prompt-status" className="bg-green-50 border-green-400 text-green-700">
                    <Markdown>{`성공 상태`}</Markdown>
                </Node>
                <Node id="result-warning" from="prompt-status" className="bg-yellow-50 border-yellow-400 text-yellow-700">
                    <Markdown>{`경고 상태`}</Markdown>
                </Node>
                <Node id="result-error" from="prompt-status" className="bg-red-50 border-red-400 text-red-700">
                    <Markdown>{`오류 상태`}</Markdown>
                </Node>

                <Node id="result-gradient" from="prompt-effect" className="bg-gradient-to-r from-blue-400 to-purple-500 text-white border-none">
                    <Markdown>{`\`\`\`tsx
<Node className="
  bg-gradient-to-r
  from-blue-400 to-purple-500
  text-white border-none
"/>
\`\`\``}</Markdown>
                </Node>

                <Node id="result-shadow" from="prompt-effect" className="shadow-xl bg-white border-gray-200">
                    <Markdown>{`\`\`\`tsx
<Node className="
  shadow-xl
  bg-white border-gray-200
"/>
\`\`\``}</Markdown>
                </Node>

                <Node id="result-rounded" from="prompt-border" className="rounded-full bg-indigo-50 border-indigo-300 text-indigo-700">
                    <Markdown>{`rounded-full`}</Markdown>
                </Node>
                <Node id="result-dashed" from="prompt-border" className="border-dashed border-2 border-gray-400">
                    <Markdown>{`border-dashed`}</Markdown>
                </Node>
                <Node id="result-thick" from="prompt-border" className="border-4 border-indigo-500">
                    <Markdown>{`border-4`}</Markdown>
                </Node>

                <Node id="result-glass" from="prompt-glass" className="bg-white/50 backdrop-blur-sm border-white/30">
                    <Markdown>{`\`\`\`tsx
<Node className="
  bg-white/50
  backdrop-blur-sm
  border-white/30
"/>
\`\`\`

반투명 배경 + 블러 효과`}</Markdown>
                </Node>
            </MindMap>
        </Canvas>
    );
}
