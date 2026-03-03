# 마인드맵 마크다운 (MindMap Markdown)

마인드맵 `Node` 컴포넌트 내에서 마크다운 문법을 지원합니다. 헤더, 리스트, 테이블, 코드블럭 등 다양한 마크다운 요소를 사용할 수 있습니다.

## Import

```tsx
import { Canvas, MindMap, Node, Markdown } from 'magam';
```

## 사용법

### 기본 예제

```tsx
<MindMap x={100} y={100}>
  <Node id="intro">
    <Markdown>
      {`# 프로젝트 소개

React 기반 **다이어그램** 도구입니다.

- 마인드맵 지원
- 마크다운 렌더링
- 커스텀 스타일링`}
    </Markdown>
  </Node>
</MindMap>
```

### 지원 요소

| 요소 | 마크다운 문법 | 설명 |
|------|--------------|------|
| 헤더 | `# H1` ~ `###### H6` | 제목 레벨 1-6 |
| 굵게 | `**bold**` | 굵은 텍스트 |
| 기울임 | `*italic*` | 기울임 텍스트 |
| 리스트 | `- item` 또는 `1. item` | 순서 없음/있음 리스트 |
| 인라인 코드 | `` `code` `` | 인라인 코드 |
| 코드 블록 | ` ``` ` | 여러 줄 코드 블록 |
| 테이블 | `\| A \| B \|` | 마크다운 테이블 |
| 링크 | `[text](url)` | 하이퍼링크 |

## API 명세 (Props)

### Markdown 컴포넌트

| Prop | 타입 | 필수 | 설명 |
|------|------|------|------|
| `children` | string | **O** | 마크다운 문자열 |
| `className` | string | X | 추가 스타일 (Tailwind CSS) |
| `variant` | `'default'` \| `'minimal'` | X | 스타일 프리셋. 기본값 `'default'` |

## 스타일링

### 기본 스타일 (Black & White)

기본적으로 흑백 기반의 깔끔한 스타일이 적용됩니다:
- 텍스트: `#1e293b` (slate-800)
- 배경: 투명
- 코드 배경: `#f1f5f9` (slate-100)

### Tailwind CSS 커스터마이징

`className` prop을 통해 Tailwind 클래스를 추가할 수 있습니다:

```tsx
<Node id="styled">
  <Markdown className="prose-headings:text-blue-600 prose-code:bg-blue-50">
    {`# 커스텀 스타일
    
코드 예시: \`const x = 1\``}
  </Markdown>
</Node>
```

### 사용 가능한 Tailwind Typography 클래스

`@tailwindcss/typography` 플러그인의 `prose` 수정자를 사용합니다:

- `prose-headings:*` - 헤더 스타일
- `prose-p:*` - 문단 스타일  
- `prose-code:*` - 인라인 코드 스타일
- `prose-pre:*` - 코드 블록 스타일
- `prose-a:*` - 링크 스타일
- `prose-li:*` - 리스트 아이템 스타일

## 기술 설계

### 의존성

- `react-markdown`: 마크다운 → React 요소 변환
- `@tailwindcss/typography`: prose 클래스 기반 타이포그래피 스타일

### 컴포넌트 구조

```
Markdown (React Component)
  └── react-markdown (마크다운 파서)
      └── prose 클래스 적용 (기본 스타일)
          └── className으로 추가 커스터마이징
```

### 내부 동작

1. `children`으로 전달된 마크다운 문자열을 `react-markdown`이 파싱
2. `prose prose-sm` 기본 클래스로 흑백 타이포그래피 적용
3. 사용자 `className`이 머지되어 커스텀 스타일 적용

## 주의 사항

- `Markdown` 컴포넌트는 `Node` 내부에서만 사용하세요.
- 긴 마크다운 콘텐츠는 노드 크기에 영향을 줄 수 있습니다.
- HTML 태그 삽입은 보안상 기본적으로 비활성화됩니다.
