import { Canvas, MindMap, Node, Markdown, Text } from '@magam/core';

/**
 * Magam 로드맵 & TODO
 * 
 * 📋 이 파일 자체가 Magam로 만든 TODO 목록입니다!
 * "Eating our own dog food" - 우리가 만든 도구로 우리의 계획을 관리합니다.
 */
export default function TODORoadmap() {
    return (
        <Canvas>
            <Text id="root.seed" x={0} y={0} className="text-[1px] text-transparent select-none">.</Text>
            <Text id="core.seed" x={-360} y={0} className="text-[1px] text-transparent select-none">.</Text>
            <Text id="ui.seed" x={-360} y={320} className="text-[1px] text-transparent select-none">.</Text>
            <Text id="content.seed" x={0} y={-320} className="text-[1px] text-transparent select-none">.</Text>
            <Text id="diagrams.seed" x={360} y={0} className="text-[1px] text-transparent select-none">.</Text>
            <Text id="learning.seed" x={360} y={320} className="text-[1px] text-transparent select-none">.</Text>
            <Text id="export.seed" x={0} y={360} className="text-[1px] text-transparent select-none">.</Text>
            <Text id="mcp.seed" x={420} y={360} className="text-[1px] text-transparent select-none">.</Text>

            {/* 중앙 타이틀 */}
            <MindMap id="root" layout="bidirectional">
                <Node id="title" bubble from={{ node: 'root.seed', edge: { stroke: 'transparent', strokeWidth: 0 } }}>
                    <Markdown>{`# 🚀 Magam 로드맵

> **"코드로 시각화하고, 시각화로 생각한다"**

현재 버전: \`0.1.0-alpha\`
최종 업데이트: 2026-02-03`}</Markdown>
                </Node>
            </MindMap>

            {/* ========== 핵심 기능 (왼쪽 상단) ========== */}
            <MindMap id="core" layout="bidirectional" anchor="root" position="left" gap={350}>
                <Node id="title" bubble from={{ node: 'core.seed', edge: { stroke: 'transparent', strokeWidth: 0 } }}>
                    <Markdown className="border-l-4 border-blue-500 pl-3 bg-blue-50">{`## 🔧 핵심 기능 개선

에디터 경험을 향상시키는 필수 기능들`}</Markdown>
                </Node>

                <Node id="toolbar" from="title">
                    <Markdown>{`### 🖱️ 플로팅 툴바

**설명**
캔버스 우측에 고정되는 컨텍스트 툴바.
선택 모드와 이동 모드를 원클릭으로 전환하고,
자주 쓰는 액션에 빠르게 접근.

**포함 기능**
- [ ] 선택 / 이동 모드 토글
- [ ] 줌 인/아웃 버튼
- [ ] fit-to-view 버튼
- [ ] 미니맵 토글

**우선순위**: 🔴 높음
[x] 구현 완료
`}</Markdown>
                </Node>

                <Node id="node-id" from="title">
                    <Markdown>{`### [x] 📋 노드 ID 복사

**설명**
노드를 선택한 상태에서 \`Cmd+C\`를 누르면
노드 ID가 클립보드에 복사됨.
링크 작성 시 유용.

**동작 흐름**
1. 노드 클릭하여 선택
2. \`Cmd+C\` 입력
3. 클립보드에 \`"mindmap.node-id"\` 복사
4. 토스트: "노드 ID 복사됨!"

**우선순위**: 🟡 중간`}</Markdown>
                </Node>

                <Node id="anchor" from="title">
                    <Markdown>{`### ⚓ Anchor 기능 개선 🔥

**현재 문제**
\`position="left"\` 등 방향 지정 시
의도와 다른 위치에 배치되는 버그 존재.

**개선 사항**
- [ ] 방향 배치 로직 재설계
- [ ] 충돌 감지 알고리즘 개선
- [ ] \`align\` 옵션 (start/center/end)
- [ ] 간격 자동 조정

**우선순위**: 🔴 높음 (핵심 UX)`}</Markdown>
                </Node>

                <Node id="search" from="title">
                    <Markdown>{`### 🔍 검색 기능

**설명**
현재 캔버스 내 노드를 키워드로 검색.
결과 노드를 하이라이트하고 포커스 이동.

**기능 목록**
- [ ] \`Cmd+F\` 검색 패널
- [ ] 실시간 필터링
- [ ] 결과 노드 하이라이트
- [ ] 이전/다음 결과 탐색

**🤖 AI 연동 가능**
\`\`\`
👤 "API 관련 노드 찾아줘"
🤖 "3개의 노드를 찾았습니다:
   - api-server
   - api-gateway  
   - rest-endpoints"
\`\`\`

**우선순위**: 🟡 중간`}</Markdown>
                </Node>

                <Node id="performance" from="title">
                    <Markdown>{`### ⚡ 성능 최적화

**목표**
1000+ 노드에서도 부드러운 렌더링.
파일 로딩 속도 개선.

**최적화 포인트**
- [ ] 가상화 스크롤 (viewport culling)
- [ ] 레이아웃 계산 Web Worker 분리
- [ ] 메모이제이션 강화
- [ ] 청크 단위 렌더링

**벤치마크 목표**
- 초기 로딩: < 500ms
- 60fps 유지 (1000 노드)`}</Markdown>
                </Node>
            </MindMap>

            {/* ========== UI/UX (왼쪽 하단) ========== */}
            <MindMap id="ui" layout="bidirectional" anchor="core" position="bottom" gap={120}>
                <Node id="title" bubble from={{ node: 'ui.seed', edge: { stroke: 'transparent', strokeWidth: 0 } }}>
                    <Markdown className="border-l-4 border-purple-500 pl-3 bg-purple-50">{`## 🎨 UI/UX 개선

더 아름답고 사용하기 편한 인터페이스`}</Markdown>
                </Node>

                <Node id="theme" from="title">
                    <Markdown>{`### 🌓 테마 시스템

**설명**
라이트/다크 모드 지원 및
커스텀 색상 팔레트 정의.

**기능 목록**
- [ ] 시스템 설정 자동 감지
- [ ] 수동 토글 버튼
- [ ] 커스텀 색상 팔레트 정의
- [ ] 프리셋 테마 (Nord, Dracula 등)

**CSS 변수 활용**
\`\`\`css
:root {
  --bg-primary: #ffffff;
  --text-primary: #1a1a1a;
}
[data-theme="dark"] {
  --bg-primary: #0d1117;
  --text-primary: #e6edf3;
}
\`\`\``}</Markdown>
                </Node>

                <Node id="background" from="title">
                    <Markdown>{`### 🏁 백그라운드 옵션

**설명**
캔버스 배경을 다양한 패턴으로 설정.
작업 맥락에 맞는 시각적 환경 제공.

**옵션**
- [ ] 단색 배경
- [ ] 닷 그리드 (현재 기본값)
- [ ] 라인 그리드
- [ ] 아이소메트릭 그리드
- [ ] 커스텀 이미지/텍스처

**🤖 AI 연동**
\`\`\`
👤 "배경을 깔끔한 흰색으로 바꿔줘"
🤖 "배경을 흰색 단색으로 변경했습니다."
\`\`\``}</Markdown>
                </Node>

                <Node id="tabs" from="title">
                    <Markdown>{`### 📑 탭 기능

**설명**
브라우저처럼 여러 캔버스를 탭으로 열기.
작업 컨텍스트를 쉽게 전환.

**기능 목록**
- [ ] 탭 바 UI
- [ ] 탭 드래그 재정렬
- [ ] 탭 닫기 (Cmd+W)
- [ ] 새 탭 열기 (Cmd+T)
- [ ] 분할 뷰 (좌우/상하)`}</Markdown>
                </Node>

                <Node id="folders" from="title">
                    <Markdown>{`### 📁 폴더 구조

**설명**
사이드바에서 폴더 트리를 표시.
파일 및 폴더 관리 기능.

**기능 목록**
- [ ] 트리 뷰 UI
- [ ] 폴더 생성/삭제
- [ ] 파일 생성/삭제
- [ ] 드래그 앤 드롭 정렬
- [ ] 파일 이름 변경

**🤖 AI 연동**
\`\`\`
👤 "projects 폴더 안에 
    new-idea.tsx 파일 만들어줘"
🤖 "projects/new-idea.tsx 파일을 
    생성했습니다."
\`\`\``}</Markdown>
                </Node>
            </MindMap>

            {/* ========== 콘텐츠 기능 (상단) ========== */}
            <MindMap id="content" layout="bidirectional" anchor="root" position="top" gap={250}>
                <Node id="title" bubble from={{ node: 'content.seed', edge: { stroke: 'transparent', strokeWidth: 0 } }}>
                    <Markdown className="border-t-4 border-green-500 pt-3 bg-green-50">{`## 📝 콘텐츠 기능

노드 내부 콘텐츠를 풍부하게`}</Markdown>
                </Node>

                <Node id="image" from="title">
                    <Markdown>{`### 🖼️ 이미지 삽입

**설명**
노드 내에 이미지를 삽입하여
시각적 정보 전달력 강화.

**지원 방식**
- [ ] 로컬 파일 선택
- [ ] URL 입력
- [ ] 클립보드 붙여넣기
- [ ] 드래그 앤 드롭

**사용 예시**
\`\`\`tsx
<Node id="logo">
  <Image src="./assets/logo.png" />
</Node>
\`\`\`

**🤖 AI 연동**
\`\`\`
👤 "이 노드에 아키텍처 
    다이어그램 이미지 넣어줘"
🤖 "architecture.png를 
    삽입했습니다."
\`\`\``}</Markdown>
                </Node>

                <Node id="icons" from="title">
                    <Markdown>{`### ✨ Lucide 아이콘

**설명**
1000+ 개의 Lucide 아이콘을
노드 제목이나 본문에 삽입.

**기능 목록**
- [ ] 아이콘 피커 UI
- [ ] 아이콘 검색
- [ ] 크기/색상 커스터마이징
- [ ] 자주 쓰는 아이콘 즐겨찾기

**사용 예시**
\`\`\`tsx
<Node id="settings">
  <Icon name="settings" size={24} />
  설정
</Node>
\`\`\``}</Markdown>
                </Node>

                <Node id="links" from="title">
                    <Markdown>{`### 🔗 링크 기능 강화

**설명**
노드 간 링크를 더욱 강력하게.
파일 간 참조 및 미리보기 지원.

**개선 사항**
- [ ] 다른 파일의 노드에 링크
- [ ] 링크 호버 시 미리보기
- [ ] 외부 URL 썸네일 표시
- [ ] 양방향 링크 자동 생성

**양방향 링크 예시**
\`A → B\` 링크 생성 시
자동으로 \`B → A\` 역링크 추가

**🤖 AI 연동**
\`\`\`
👤 "이 노드와 관련된 
    모든 링크 보여줘"
🤖 "3개의 연결된 노드:
   ← database-schema
   → api-endpoints
   ↔ user-model"
\`\`\``}</Markdown>
                </Node>

                <Node id="group" from="title">
                    <Markdown>{`### 📦 그룹 컴포넌트

**설명**
여러 노드를 하나의 그룹으로 묶어
시각적/논리적 구조화.

**기능 목록**
- [ ] 드래그로 노드 그룹화
- [ ] 그룹 스타일링 (배경색, 테두리)
- [ ] 그룹 라벨
- [ ] 그룹 접기/펼치기
- [ ] 그룹 단위 이동

**사용 예시**
\`\`\`tsx
<Group id="backend" label="Backend">
  <Node id="api">...</Node>
  <Node id="db">...</Node>
</Group>
\`\`\``}</Markdown>
                </Node>

                <Node id="import-component" from="title">
                    <Markdown>{`### 🧩 캔버스 컴포넌트화

**설명**
다른 파일의 캔버스/마인드맵을
컴포넌트로 분리하여 import/export 지원.
거대해지는 파일을 모듈 단위로 관리.

**사용 예시**
\`\`\`tsx
import { NetworkMap } from './Network';

<Canvas>
  <MindMap id="main">...</MindMap>
  <NetworkMap /> {/* 외부 컴포넌트 로드 */}
</Canvas>
\`\`\`

**우선순위**: 🔴 높음 (유지보수성 핵심)`}</Markdown>
                </Node>
            </MindMap>

            {/* ========== 다이어그램 플러그인 (오른쪽 상단) ========== */}
            <MindMap id="diagrams" layout="bidirectional" anchor="root" position="right" gap={350}>
                <Node id="title" bubble from={{ node: 'diagrams.seed', edge: { stroke: 'transparent', strokeWidth: 0 } }}>
                    <Markdown className="border-r-4 border-amber-500 pr-3 bg-amber-50">{`## 📊 다이어그램 플러그인

확장 가능한 다이어그램 생태계`}</Markdown>
                </Node>

                <Node id="plugin-system" from="title">
                    <Markdown>{`### 🔌 플러그인 시스템 🔥

**설명**
커스텀 노드 타입과 컴포넌트를
플러그인으로 추가할 수 있는 시스템.

**아키텍처**
\`\`\`
ComponentRegistry
  ├── register(name, component)
  ├── get(name)
  └── list()
\`\`\`

**기능 목록**
- [ ] 컴포넌트 레지스트리
- [ ] 동적 플러그인 로딩
- [ ] 플러그인 설정 UI
- [ ] 플러그인 마켓플레이스 (미래)

**우선순위**: 🔴 높음 (확장성 핵심)`}</Markdown>
                </Node>

                <Node id="sequence" from="title">
                    <Markdown>{`### ➡️ 시퀀스 다이어그램

**설명**
시스템 간 상호작용을 시간 순서로
시각화하는 UML 다이어그램.

**컴포넌트**
- [ ] Actor (사람/시스템)
- [ ] Lifeline (생명선)
- [ ] Message (동기/비동기)
- [ ] Activation Box
- [ ] Loop/Alt 프레임

**🤖 AI 연동**
\`\`\`
👤 "로그인 플로우를 
    시퀀스 다이어그램으로 그려줘"
🤖 "User → Frontend → AuthAPI → DB
    순서로 시퀀스 다이어그램을 
    생성했습니다."
\`\`\``}</Markdown>
                </Node>

                <Node id="erd" from="title">
                    <Markdown>{`### 🗄️ ERD 다이어그램

**설명**
데이터베이스 스키마를 시각화하는
Entity-Relationship 다이어그램.

**컴포넌트**
- [ ] Entity Box (테이블)
- [ ] Attribute (컬럼, PK/FK)
- [ ] Relationship (1:1, 1:N, N:M)
- [ ] Cardinality 표기

**🤖 AI 연동**
\`\`\`
👤 "users와 orders 테이블의 
    ERD 만들어줘"
🤖 "users (1) ──→ (N) orders
    관계로 ERD를 생성했습니다."
\`\`\``}</Markdown>
                </Node>

                <Node id="shapes" from="title">
                    <Markdown>{`### 🔷 도형 강화

**설명**
다양한 기본 도형과 정밀한
커넥터 기능.

**추가 도형**
- [ ] 다이아몬드 (결정)
- [ ] 평행사변형 (입출력)
- [ ] 실린더 (데이터베이스)
- [ ] 클라우드 (외부 시스템)
- [ ] 화살표/브래킷

**커넥터 개선**
- [ ] 8방향 커넥터 포인트
- [ ] 그리드 스냅
- [ ] 자동 경로 계산`}</Markdown>
                </Node>
            </MindMap>

            {/* ========== 학습 기능 (오른쪽 하단) ========== */}
            <MindMap id="learning" layout="bidirectional" anchor="diagrams" position="bottom" gap={120}>
                <Node id="title" bubble from={{ node: 'learning.seed', edge: { stroke: 'transparent', strokeWidth: 0 } }}>
                    <Markdown className="border-r-4 border-pink-500 pr-3 bg-pink-50">{`## 🧠 학습 강화 기능

지식 습득과 기억을 돕는 기능들`}</Markdown>
                </Node>

                <Node id="spaced" from="title">
                    <Markdown>{`### 🔄 간격 반복 학습 ⭐

**설명**
Anki, RemNote에서 영감을 받은
마인드맵 노드 기반 플래시카드 시스템.

**동작 원리**
1. 노드를 학습 대상으로 마킹
2. SM-2 알고리즘으로 복습 일정 계산
3. 데일리 복습 세션 제공
4. 기억력 통계 대시보드

**🤖 AI 채팅 예시**
\`\`\`
👤 "오늘 복습해야 할 노드들 보여줘"
🤖 "오늘 복습할 노드 5개:
   1. 🔴 OSI 7계층 (기한 지남!)
   2. 🟡 TCP vs UDP
   3. 🟢 HTTP 메서드
   4. 🟢 REST API 원칙
   5. 🟢 OAuth 2.0 플로우"
   
👤 "첫 번째 노드에서 퀴즈 내줘"
🤖 "Q: OSI 모델의 4번째 계층은?
   힌트: 데이터 전송 담당
   
   정답 보기 / 힌트 더 보기"
\`\`\`

**우선순위**: ⭐ 핵심 차별화 기능`}</Markdown>
                </Node>

                <Node id="tags" from="title">
                    <Markdown>{`### 🏷️ 태그 시스템

**설명**
노드에 태그를 붙여 분류하고
필터링/검색에 활용.

**기능 목록**
- [ ] 노드 태그 추가 (\`#concept\`)
- [ ] 태그 자동완성
- [ ] 태그 기반 필터링
- [ ] 태그 그룹화 뷰
- [ ] 태그 색상 지정

**🤖 AI 채팅 예시**
\`\`\`
👤 "모든 #question 태그 노드를 
    빨간색으로 바꿔줘"
🤖 "12개의 #question 노드를 
    찾아 빨간색으로 변경했습니다."

👤 "#important 태그 붙은 것만 보여줘"
🤖 "필터를 적용했습니다. 
    8개 노드가 표시됩니다."
\`\`\``}</Markdown>
                </Node>

                <Node id="visual" from="title">
                    <Markdown>{`### 🎭 시각 기억술

**설명**
기억 궁전(Memory Palace) 기법을
디지털 마인드맵에 적용.

**기능 목록**
- [ ] 노드 이미지/아이콘 연결
- [ ] 영역 기반 "방" 정의
- [ ] 컬러 코딩 프리셋
- [ ] 스토리라인 경로 설정

**활용 예시**
- 방1 (파란 영역): 네트워크 개념
- 방2 (초록 영역): 데이터베이스
- 경로: 방1 → 방2 순서로 복습

**🤖 AI 채팅 예시**
\`\`\`
👤 "이 마인드맵을 기억 궁전으로 
    구성해줘"
🤖 "3개의 '방'을 제안합니다:
   🔵 입구: 기초 개념 (5개 노드)
   🟢 중앙홀: 핵심 원리 (8개 노드)
   🟣 서재: 심화 내용 (4개 노드)
   
   이 구성으로 진행할까요?"
\`\`\``}</Markdown>
                </Node>

                <Node id="templates" from="title">
                    <Markdown>{`### 📚 템플릿 라이브러리 ⭐

**설명**
학습 목적별로 미리 구성된 템플릿.
AI가 가이드하며 콘텐츠 채워넣기.

**기본 템플릿**
- 📖 개념 분석 (정의/예시/비교)
- 🔄 프로젝트 회고 (KPT)
- 📕 책 요약 (챕터/핵심/인사이트)
- 💻 코드 학습 (함수/입출력/원리)
- 🧪 실험 기록 (가설/결과/결론)

**🤖 AI 채팅 예시**
\`\`\`
👤 "책 요약 템플릿으로 시작해줘"
🤖 "📕 책 요약 템플릿을 생성했습니다.
   
   먼저 책 제목을 알려주세요."
   
👤 "클린 코드"
🤖 "좋습니다! 챕터별로 정리할까요,
   아니면 주요 원칙별로 정리할까요?"
\`\`\`

**커뮤니티 생태계**
사용자 템플릿 공유 마켓플레이스!

**우선순위**: ⭐ 핵심 차별화 기능`}</Markdown>
                </Node>
            </MindMap>

            {/* ========== 내보내기 & 통합 (하단) ========== */}
            <MindMap id="export" layout="bidirectional" anchor="root" position="bottom" gap={250}>
                <Node id="title" bubble from={{ node: 'export.seed', edge: { stroke: 'transparent', strokeWidth: 0 } }}>
                    <Markdown className="border-b-4 border-cyan-500 pb-3 bg-cyan-50">{`## 📤 내보내기 & 외부 통합

다른 도구들과의 연결`}</Markdown>
                </Node>

                <Node id="formats" from="title">
                    <Markdown>{`### 💾 내보내기 형식

**설명**
캔버스를 다양한 형식으로 내보내기.
공유 및 문서화에 활용.

**지원 형식**
- [ ] PNG / JPEG 이미지
- [ ] SVG 벡터 이미지
- [ ] PDF 문서
- [ ] JSON 데이터
- [ ] 마크다운 텍스트

**옵션**
- 해상도 선택 (1x, 2x, 3x)
- 배경 포함/투명
- 선택 영역만 내보내기

**🤖 AI 연동**
\`\`\`
👤 "이 마인드맵을 PDF로 내보내줘"
🤖 "roadmap.pdf로 저장했습니다.
   (A4, 2x 해상도)"
\`\`\``}</Markdown>
                </Node>

                <Node id="obsidian" from="title">
                    <Markdown>{`### 💎 Obsidian 플러그인 🔥

**설명**
옵시디언에서 Magam 기능을
그대로 사용할 수 있는 플러그인.

**구현 방식**
1. 마크다운 코드블럭 렌더링
2. 웹뷰 기반 에디터

**사용 예시**
\`\`\`markdown
# 나의 노트

\\\`\\\`\\\`magam
<MindMap layout="bidirectional">
  <Node id="main">중심 주제</Node>
  <Node from="main">하위 개념 1</Node>
  <Node from="main">하위 개념 2</Node>
</MindMap>
\\\`\\\`\\\`
\`\`\`

**양방향 동기화**
- 옵시디언 → Magam
- Magam → 옵시디언 노트

**우선순위**: 🔴 높음 (주요 타겟 플랫폼)`}</Markdown>
                </Node>

                <Node id="vscode" from="title">
                    <Markdown>{`### 💻 VS Code 확장

**설명**
VS Code에서 .tsx 파일을 작성하면서
실시간으로 캔버스를 프리뷰.

**기능 목록**
- [ ] 사이드 패널 프리뷰
- [ ] Hot Reload 연동
- [ ] 노드 클릭 → 코드 위치 이동
- [ ] 코드 수정 → 캔버스 자동 갱신

**개발자 경험**
\`\`\`
┌─────────────┬──────────────┐
│ TSX Editor  │  Live Canvas │
│             │              │
│ <Node ...>  │    ○──○      │
│             │     ╲        │
│             │      ○       │
└─────────────┴──────────────┘
\`\`\`

**우선순위**: 🟡 중간 (개발자 대상)`}</Markdown>
                </Node>
            </MindMap>

            {/* ========== MCP & AI 통합 (하단 우측) ========== */}
            <MindMap id="mcp" layout="bidirectional" anchor="export" position="right" gap={150}>
                <Node id="title" bubble from={{ node: 'mcp.seed', edge: { stroke: 'transparent', strokeWidth: 0 } }}>
                    <Markdown className="border-b-4 border-violet-500 pb-3 bg-violet-50">{`## 🤖 MCP & AI 통합

Model Context Protocol로 AI 직접 연결`}</Markdown>
                </Node>

                <Node id="server" from="title">
                    <Markdown>{`### 🖥️ MCP 서버 🔥

**설명**
Magam를 MCP 서버로 노출하여
Claude, GPT 등 AI가 직접 캔버스를 조작.

**아키텍처**
\`\`\`
┌─────────────┐     MCP      ┌────────────┐
│   Claude    │ ◀──────────▶ │ Magam │
│   Desktop   │   JSON-RPC   │ MCP Server │
└─────────────┘              └────────────┘
\`\`\`

**프로토콜**
- JSON-RPC 2.0 over stdio
- Server-Sent Events (SSE)

**구현 목록**
- [ ] MCP 서버 엔트리포인트
- [ ] Tool 핸들러
- [ ] Resource 프로바이더
- [ ] Prompt 템플릿

**우선순위**: 🔴 높음 (AI-First 핵심)`}</Markdown>
                </Node>

                <Node id="tools" from="title">
                    <Markdown>{`### 🛠️ MCP Tools

**설명**
AI가 호출할 수 있는 도구(Tool) 정의.
캔버스 조작의 모든 기능을 노출.

**도구 목록**
\`\`\`typescript
// 노드 조작
canvas.addNode(id, content, position)
canvas.updateNode(id, changes)
canvas.deleteNode(id)
canvas.moveNode(id, x, y)

// 엣지 조작
canvas.addEdge(from, to, label?)
canvas.deleteEdge(id)

// 조회
canvas.getNodes(filter?)
canvas.getNode(id)
canvas.search(query)

// 파일
file.open(path)
file.save()
file.export(format)
\`\`\`

**🤖 실제 호출 예시**
\`\`\`json
{
  "method": "canvas.addNode",
  "params": {
    "id": "new-concept",
    "content": "## 새로운 개념",
    "from": "parent-node"
  }
}
\`\`\`

**우선순위**: 🔴 높음`}</Markdown>
                </Node>

                <Node id="resources" from="title">
                    <Markdown>{`### 📂 MCP Resources

**설명**
AI가 읽을 수 있는 리소스(Resource) 정의.
캔버스의 현재 상태를 컨텍스트로 제공.

**리소스 목록**
\`\`\`
canvas://current/nodes
canvas://current/edges  
canvas://current/selected
canvas://file/{path}
template://list
template://{name}
\`\`\`

**활용 시나리오**
AI가 현재 캔버스 상태를 읽고
맥락을 이해한 후 적절한 도구 호출

\`\`\`
🤖 [내부] canvas://current/nodes 읽기
🤖 [내부] 5개 노드 확인, 루트는 "API 설계"
🤖 "현재 API 설계 마인드맵에 
   인증 관련 노드를 추가할까요?"`}</Markdown>
                </Node>

                <Node id="prompts" from="title">
                    <Markdown>{`### 💬 MCP Prompts

**설명**
자주 쓰는 작업을 프롬프트 템플릿으로.
AI가 제안하고 사용자가 선택.

**프롬프트 목록**
- \`mindmap/brainstorm\` - 브레인스토밍
- \`mindmap/summarize\` - 요약 생성
- \`mindmap/expand\` - 노드 확장
- \`diagram/sequence\` - 시퀀스 생성
- \`diagram/erd\` - ERD 생성
- \`learn/flashcard\` - 플래시카드 생성

**🤖 프롬프트 호출 예시**
\`\`\`
👤 "/" 입력
🤖 "사용 가능한 프롬프트:
   /brainstorm - 아이디어 확장
   /summarize - 요약 생성
   /flashcard - 학습 카드 생성"

👤 "/brainstorm 마이크로서비스"
🤖 "마이크로서비스 주제로 확장합니다:
   ├── API Gateway
   ├── Service Discovery
   ├── Load Balancing
   └── Circuit Breaker
   
   이 노드들을 추가할까요?"
\`\`\``}</Markdown>
                </Node>

                <Node id="clients" from="title">
                    <Markdown>{`### 🔌 지원 AI 클라이언트

**1차 지원 (MCP 네이티브)**
- ✅ Claude Desktop
- ✅ Claude Code (Anthropic)
- ✅ Cursor IDE

**2차 지원 (어댑터)**
- 🔄 OpenAI GPT (Function Calling)
- 🔄 GitHub Copilot
- 🔄 Gemini (Tool Use)

**연동 설정 (Claude Desktop)**
\`\`\`json
// claude_desktop_config.json
{
  "mcpServers": {
    "magam": {
      "command": "npx",
      "args": ["magam-mcp"]
    }
  }
}
\`\`\`

**🤖 완성된 경험**
\`\`\`
👤 "현재 마인드맵에서 
   #todo 태그 노드들을 찾아서
   우선순위별로 정렬해줘"
   
🤖 [canvas.search 호출]
🤖 [canvas.moveNode 호출 x 5]
🤖 "5개의 TODO 노드를 우선순위순으로
   재배치했습니다:
   1. 🔴 MCP 서버 구현
   2. 🔴 Anchor 버그 수정
   3. 🟡 검색 기능
   4. 🟡 테마 시스템
   5. 🟢 탭 기능"
\`\`\`

**우선순위**: ⭐ 핵심 차별화`}</Markdown>
                </Node>
            </MindMap>
        </Canvas>
    );
}
