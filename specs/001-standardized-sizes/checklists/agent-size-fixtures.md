# Agent Size Fixtures (SC-001)

고정된 AI Agent 출력 검증용 fixture 카탈로그(총 60건).
목표: 인스코프 컴포넌트(`Text`, `Sticky`, `Shape`, `Markdown`)가 단일 계약(`fontSize`/`size`)을 준수하고 파서/렌더가 예외 없이 완료되는지 검증한다.

## Text (12)

- T01 `Text fontSize="xs"`
- T02 `Text fontSize="s"`
- T03 `Text fontSize="m"`
- T04 `Text fontSize="l"`
- T05 `Text fontSize="xl"`
- T06 `Text fontSize={12}`
- T07 `Text fontSize={16}`
- T08 `Text fontSize={24}`
- T09 `Text fontSize="unknown"` -> warning + fallback(`m`)
- T10 `Text without fontSize` -> fallback(`m`)
- T11 `Text fontSize={-1}` -> warning + fallback(`m`)
- T12 `Text fontSize={NaN}` -> warning + fallback(`m`)

## Sticky (16)

- S01 `Sticky size="xs"`
- S02 `Sticky size="m"`
- S03 `Sticky size="xl"`
- S04 `Sticky size={120}` (primitive numeric, landscape path)
- S05 `Sticky size={{ token: "s" }}`
- S06 `Sticky size={{ token: "s", ratio: "landscape" }}`
- S07 `Sticky size={{ token: "s", ratio: "portrait" }}`
- S08 `Sticky size={{ token: "s", ratio: "square" }}`
- S09 `Sticky size={{ widthHeight: "m" }}`
- S10 `Sticky size={{ widthHeight: 140 }}`
- S11 `Sticky size={{ width: "l", height: "s" }}`
- S12 `Sticky size={{ width: 200, height: 120 }}`
- S13 `Sticky size={{ token: "m", widthHeight: "m" }}` -> warning + category fallback
- S14 `Sticky size={{ token: "m", ratio: "diagonal" }}` -> warning + `landscape`
- S15 `Sticky width={320} height={200}` (legacy) -> warning + ignore
- S16 `Sticky size="unknown"` -> warning + fallback(`m+landscape`)

## Shape (16)

- H01 `Shape rectangle size="xs"`
- H02 `Shape rectangle size="m"`
- H03 `Shape rectangle size={120}` (primitive numeric)
- H04 `Shape rectangle size={{ token: "l", ratio: "portrait" }}`
- H05 `Shape rectangle size={{ widthHeight: "m" }}`
- H06 `Shape rectangle size={{ width: "l", height: 160 }}`
- H07 `Shape circle size="m"` -> default ratio `square`
- H08 `Shape circle size={{ token: "m", ratio: "portrait" }}` -> warning + `square`
- H09 `Shape triangle size="m"` -> default ratio `square`
- H10 `Shape triangle size={{ token: "s", ratio: "landscape" }}` -> warning + `square`
- H11 `Shape size={{ token: "m", widthHeight: "m" }}` -> warning + category fallback
- H12 `Shape size={{ token: "m", ratio: "diagonal" }}` -> warning + `landscape`
- H13 `Shape size={{ width: "xl", height: "s" }}`
- H14 `Shape size={{ width: 240, height: 180 }}`
- H15 `Shape width={260} height={140}` (legacy) -> warning + ignore
- H16 `Shape size="unknown"` -> warning + fallback(`m+landscape`)

## Markdown (12)

- M01 `Markdown size="xs"` (1D)
- M02 `Markdown size="m"` (1D)
- M03 `Markdown size={14}` (1D)
- M04 `Markdown size={20}` (1D)
- M05 `Markdown size={{ token: "s" }}` (2D)
- M06 `Markdown size={{ token: "m", ratio: "portrait" }}` (2D)
- M07 `Markdown size={{ token: "m", ratio: "square" }}` (2D)
- M08 `Markdown size={{ widthHeight: "l" }}` (2D)
- M09 `Markdown size={{ widthHeight: 180 }}` (2D)
- M10 `Markdown size={{ width: "xl", height: 200 }}` (2D)
- M11 `Markdown size={{ token: "m", widthHeight: "m" }}` -> warning + category fallback
- M12 `Markdown size="unknown"` -> warning + fallback(`typography=m`)

## Out Of Scope (4)

- O01 `Sequence size="m"` -> warning + ignore
- O02 `Sequence size={{ token: "m", ratio: "portrait" }}` -> warning + ignore
- O03 `Sticker size="m"` -> warning + ignore
- O04 `Sticker size={{ widthHeight: "m" }}` -> warning + ignore

