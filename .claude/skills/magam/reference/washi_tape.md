# WashiTape Reference

This guide covers practical usage of `WashiTape` in Magam diagrams, including placement modes, pattern types, and sticker-mix layout guidance.

## Import

```tsx
import { Canvas, Shape, Sticker, Image, Text, WashiTape } from '@magam/core';
```

## Quick Start

Use either `x` + `y` coordinates or an explicit `at` placement object.

```tsx
<Canvas>
  <WashiTape id="w1" x={120} y={80} width={220} height={34} preset="pastel-dots">
    Top Priority
  </WashiTape>
</Canvas>
```

## Placement Modes

### 1) Polar (`at.type = 'polar'`)

```tsx
<WashiTape
  id="w-polar"
  at={{ type: 'polar', x: 700, y: 360, length: 240, angle: -8, thickness: 36 }}
>
  Ship Checklist
</WashiTape>
```

### 2) Segment (`at.type = 'segment'`)

```tsx
<WashiTape
  id="w-segment"
  at={{
    type: 'segment',
    from: { x: 380, y: 280 },
    to: { x: 650, y: 320 },
    thickness: 34,
  }}
  pattern={{ type: 'solid', color: '#fed7aa' }}
>
  Review Window
</WashiTape>
```

### 3) Attach (`at.type = 'attach'`)

```tsx
<Shape id="target-card" x={760} y={140}>Retro Board</Shape>

<WashiTape
  id="w-attach"
  at={{
    type: 'attach',
    target: 'target-card',
    placement: 'top',
    span: 0.72,
    align: 0.5,
    offset: 10,
    thickness: 28,
  }}
  pattern={{ type: 'svg', markup: '<svg>...</svg>' }}
>
  QA Sign-off
</WashiTape>
```

## Pattern Types

- `preset`: `preset="pastel-dots"` or `pattern={{ type: 'preset', id: 'kraft-grid' }}`
- `solid`: `pattern={{ type: 'solid', color: '#fed7aa' }}`
- `svg`: `pattern={{ type: 'svg', markup: '<svg>...</svg>' }}`
- `image`: `pattern={{ type: 'image', src: dataUri, scale: 1, repeat: 'repeat-x' }}`

## Style Options

- `edge`: `edge={{ torn: true, roughness: 1.3 }}`
- `texture`: `texture={{ opacity: 0.18, blendMode: 'multiply' }}`
- `text`: `text={{ align: 'center', color: '#78350f', size: 14 }}`
- `opacity`: `opacity={0.92}`

## Mixing With Stickers

If a canvas mixes `WashiTape` and `Sticker`, separate visual zones to avoid overlap by default.

```tsx
<WashiTape id="w-main" x={100} y={90} width={220} height={34}>Top Priority</WashiTape>

<Sticker id="s-mood" x={1020} y={34}>Good Day</Sticker>
<Sticker id="s-emoji" x={1184} y={46}>🌿✨📷</Sticker>
<Sticker id="s-image" x={1008} y={116}>
  <Image src={dataUri} alt="Washi tape sticker" width={158} height={70} />
</Sticker>
```

Recommended layout policy:

- Keep `WashiTape` in the main content lane (labels, emphasis strips).
- Keep `Sticker` in side/top decoration lanes.
- Use `attach` for object-bound labels and avoid placing decorative stickers on the same target edge.

## Full Example

Working sample file:

- `examples/washi_tape.tsx`
