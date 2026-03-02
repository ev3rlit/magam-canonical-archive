import { Canvas, MindMap, Node, Markdown, Text } from '@magam/core';

/**
 * 마크다운 & 코드 블럭 쇼케이스
 *
 * AI에게 요청하면 마크다운 콘텐츠가 완성되는 워크플로우를 보여줍니다.
 */
export default function ShowcaseMarkdown() {
    return (
        <Canvas>
            <Text id="showcase-markdown-map.seed" x={0} y={0} className="text-[1px] text-transparent select-none">.</Text>
            <MindMap id="showcase-markdown-map" layout="bidirectional">
                {/* Root */}
                <Node
                    id="root"
                    bubble
                    from={{ node: 'showcase-markdown-map.seed', edge: { stroke: 'transparent', strokeWidth: 0 } }}
                >
                    <Markdown>{`# Magam + AI

> "magam" 스킬로 대화하면
> 코드가 완성됩니다`}</Markdown>
                </Node>

                {/* Level 1: 프롬프트 */}
                <Node id="prompt-table" from="root">
                    <Markdown>{`**"컴포넌트 목록을 테이블로 정리해줘"**`}</Markdown>
                </Node>

                <Node id="prompt-code" from="root">
                    <Markdown>{`**"이 마인드맵 코드 예시를 보여줘"**`}</Markdown>
                </Node>

                <Node id="prompt-checklist" from="root">
                    <Markdown>{`**"프로젝트 진행 현황을 체크리스트로"**`}</Markdown>
                </Node>

                <Node id="prompt-summary" from="root">
                    <Markdown>{`**"핵심 철학을 인용문으로 정리해줘"**`}</Markdown>
                </Node>

                {/* Level 2: AI가 생성한 결과물 */}
                <Node id="result-table" from="prompt-table">
                    <Markdown>{`| 컴포넌트 | 용도 |
|----------|------|
| Canvas | 최상위 컨테이너 |
| MindMap | 자동 레이아웃 트리 |
| Node | 마인드맵 노드 |
| Shape | 자유 배치 도형 |
| Edge | 노드 간 연결선 |`}</Markdown>
                </Node>

                <Node id="result-code" from="prompt-code">
                    <Markdown>{`\`\`\`tsx
<MindMap layout="tree">
  <Node id="root">
    <Markdown># 제목</Markdown>
  </Node>
  <Node id="child" from="root">
    하위 노드
  </Node>
</MindMap>
\`\`\``}</Markdown>
                </Node>

                <Node id="result-checklist" from="prompt-checklist">
                    <Markdown>{`- [x] 컴포넌트 설계
- [x] 마크다운 렌더링
- [x] 실시간 동기화
- [ ] PNG 내보내기
- [ ] 플러그인 시스템`}</Markdown>
                </Node>

                <Node id="result-summary" from="prompt-summary">
                    <Markdown>{`> 지식 작업의 미래는
> **'그리기'가 아닌 '설명하기'**다.

\`코드 = 다이어그램\`
버전관리 · 재사용 · 자동화`}</Markdown>
                </Node>
            </MindMap>
        </Canvas>
    );
}
