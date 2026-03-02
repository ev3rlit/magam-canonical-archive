# 2026-03-02 — Sticky Markdown children + fontFamily 렌더링 버그 수정

## Summary
- Sticky 컴포넌트에 `<Markdown>` children을 넣으면 클라이언트에서 렌더링되지 않는 버그를 수정했습니다.
- 모든 노드 타입(Shape, Sticky, Markdown, Edge)에서 `fontFamily` prop이 실제로 적용되지 않는 버그를 수정했습니다.

---

## Bug 1: Sticky + Markdown children 렌더링 실패

### 증상
```tsx
<Sticky id="note" fontFamily="hand-caveat">
  <Markdown>{`# 제목\n**굵은 글씨**`}</Markdown>
</Sticky>
```
위 코드에서 Markdown이 렌더링되지 않고 plain text로 표시되거나 완전히 소실됨.

### Root Cause (2 Layers)

**Layer 1 — Parser (`childComposition.ts`)**

`parseRenderableChildren()`가 `graph-markdown` 타입을 `pushText()`로 평탄화하여 plain text로 변환함.
반면 `parseStickerChildren()`은 `{ type: 'graph-markdown', content }` 타입을 올바르게 보존.

```typescript
// Before (bug): graph-markdown → plain text로 평탄화
if (child.type === 'graph-markdown') {
  pushText(parsed, child.props?.content);
}

// After (fix): graph-markdown 타입을 보존
if (child.type === 'graph-markdown') {
  if (typeof child.props?.content === 'string') {
    parsed.push({ type: 'graph-markdown', content: child.props.content });
  }
  return;
}
```

**Layer 2 — Renderer (`renderableContent.tsx`)**

`renderNodeContent()`의 switch문에서 `graph-markdown` case가 `return null` — 렌더링 자체를 하지 않음.

```typescript
// Before (bug):
case 'graph-image':
case 'graph-markdown': {
  return null;
}

// After (fix): ReactMarkdown으로 실제 렌더링
case 'graph-markdown': {
  return (
    <div className="prose prose-slate prose-sm max-w-none"
         style={{ lineHeight: 1.2, ...textStyle }}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {child.content}
      </ReactMarkdown>
    </div>
  );
}
```

### 추가 수정

- `nodeContent.ts`: `extractNodeContent()`의 label 추출에 `graph-markdown` 타입 포함 (bubble label 지원).
- `StickyNode.tsx`: Markdown children 존재 시 레이아웃을 left-align으로 조정.

### 변경 파일
| 파일 | 변경 |
|------|------|
| `app/utils/childComposition.ts` | `graph-markdown` 타입 보존 |
| `app/utils/nodeContent.ts` | label 추출에 markdown 포함 |
| `app/components/nodes/renderableContent.tsx` | ReactMarkdown 렌더링 구현 |
| `app/components/nodes/StickyNode.tsx` | 조건부 레이아웃 |

---

## Bug 2: fontFamily가 모든 노드에서 적용되지 않음

### 증상
`fontFamily="hand-caveat"` 등을 Shape, Sticky, Markdown, Edge 어디에 설정해도 실제 폰트가 변경되지 않음.

### Root Cause — CSS 변수 체인의 중첩 `var()` 해석 실패

**기존 구조 (3단계 간접 참조):**

```
layout.tsx   : <body class="... ${gaegu.variable}">
                 → body에 --font-gaegu: '__Gaegu_abc123' 설정

globals.css  : :root {
                 --font-preset-hand-gaegu: var(--font-gaegu), fallbacks...;
               }
                 → html에서 body의 변수를 참조하는 중첩 var()

StickyNode   : style={{ fontFamily: 'var(--font-preset-hand-gaegu)' }}
                 → 최종 사용
```

CSS 스펙상 중첩 `var()`는 use time에 해석되어야 하지만, `:root`(html)에서 정의한 `var(--font-gaegu)`가 `<body>`에만 존재하는 변수를 참조하면서 런타임에서 해석에 실패.

### Fix — 중첩 `var()` 제거, 직접 해석된 값 사용

`layout.tsx`에서 next/font의 `style.fontFamily`를 사용하여 CSS 변수를 직접 생성:

```typescript
// layout.tsx — next/font가 해석한 실제 폰트 이름을 직접 사용
const fontPresetCSS = `:root {
  --font-preset-hand-gaegu: ${gaegu.style.fontFamily}, ${KR_FALLBACKS};
  --font-preset-hand-caveat: ${caveat.style.fontFamily}, ${KR_FALLBACKS};
  --font-preset-sans-inter: ${inter.style.fontFamily}, ${KR_FALLBACKS};
}`;

// <head>에 <style> 태그로 삽입
```

`globals.css`의 기존 `:root` 블록 (중첩 `var()`) 제거.

**Before (중첩 var, 해석 실패):**
```css
:root {
  --font-preset-hand-caveat: var(--font-caveat), "Apple SD Gothic Neo", ...;
}
```

**After (직접 해석된 값):**
```css
:root {
  --font-preset-hand-caveat: '__Caveat_abc123', '__Caveat_Fallback_def456', "Apple SD Gothic Neo", ...;
}
```

### 변경 파일
| 파일 | 변경 |
|------|------|
| `app/app/layout.tsx` | `style.fontFamily`로 preset 변수 직접 생성 |
| `app/app/globals.css` | 중첩 `var()` `:root` 블록 제거 |

---

## 교훈

1. **중첩 CSS `var()` 주의**: `:root`에서 정의한 커스텀 프로퍼티가 `<body>` 레벨 변수를 참조할 때, CSS 스펙상 동작해야 하지만 실무에서 해석 실패할 수 있음. next/font처럼 빌드 타임에 값을 알 수 있다면 직접 해석된 값을 사용하는 것이 안전.
2. **파서와 렌더러 양쪽 확인**: AST 파싱(childComposition)과 렌더링(renderableContent)이 분리된 구조에서는 양쪽 모두 새 타입을 지원하는지 확인 필요.
3. **기존 동작 노드와 비교**: StickerNode의 `parseStickerChildren()`은 이미 올바르게 구현되어 있었으므로, 참조 구현으로 활용.
