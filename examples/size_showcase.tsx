import {
  Canvas,
  Markdown,
  Node,
  Shape,
  Sticker,
  Sticky,
  Text } from
'@magam/core';

/**
 * Standardized Size Showcase
 *
 * - Text: fontSize (token + number)
 * - Sticky/Shape: size (token, number, ratio, widthHeight, width/height)
 * - Markdown: size single-entry (primitive=1D, object=2D)
 * - Sticker: content-driven, but inner Text can use fontSize (token + number)
 */
export default function SizeShowcase() {
  return (
    <Canvas>
      <Text id="size-title" x={40} y={24} fontSize="xl" className="font-semibold text-slate-800">
        Standardized Size Showcase
      </Text>
      <Text id="size-subtitle" x={40} y={56} fontSize="s" className="text-slate-500">
        Text / Sticky / Shape / Markdown / Sticker
      </Text>

      {/* 1) Text: 1D scale */}
      <Text id="section-text" x={40} y={104} fontSize="m" className="font-bold text-slate-700">
        Text (fontSize)
      </Text>
      <Text id="text-xs" x={40} y={136} fontSize="xs">fontSize="xs"</Text>
      <Text id="text-s" x={40} y={162} fontSize="s">fontSize="s"</Text>
      <Text id="text-m" x={40} y={190} fontSize="m">fontSize="m"</Text>
      <Text id="text-l" x={40} y={220} fontSize="l">fontSize="l"</Text>
      <Text id="text-xl" x={40} y={254} fontSize="xl">fontSize="xl"</Text>
      <Text id="text-number" x={40} y={288} fontSize={13} className="text-slate-600">
        fontSize={"{13}"} (numeric compatibility)
      </Text>

      {/* 2) Sticky: 2D scale + auto */}
      <Text id="section-sticky" x={300} y={104} fontSize="m" className="font-bold text-slate-700">
        Sticky (size)
      </Text>
      <Sticky id="sticky-landscape" x={300} y={136} size={{ token: 's', ratio: 'landscape' }}>
        size={'{ token: "s", ratio: "landscape" }'}
      </Sticky>
      <Sticky id="sticky-number" x={492} y={136} size={120}>
        size={"{120}"}
      </Sticky>
      <Sticky id="sticky-portrait" x={300} y={284} size={{ token: 'm', ratio: 'portrait' }}>
        size={'{ token: "m", ratio: "portrait" }'}
      </Sticky>
      <Sticky id="sticky-width-height-token" x={492} y={284} size={{ widthHeight: 'm' }}>
        size={'{ widthHeight: "m" }'}
      </Sticky>
      <Sticky id="sticky-auto" x={306.2297022301201} y={505.9802562808317} size="auto">
        size="auto" (content-driven)
      </Sticky>

      {/* 3) Shape: type-specific defaults + ratio + auto */}
      <Text id="section-shape" x={740} y={104} fontSize="m" className="font-bold text-slate-700">
        Shape (size)
      </Text>
      <Shape
        id="shape-rect-landscape"
        x={740.7126008327729}
        y={140}
        type="rectangle"
        size={{ token: 'm', ratio: 'landscape' }}
        className="bg-white">
        
        rect landscape
      </Shape>
      <Shape
        id="shape-rect-portrait"
        x={980}
        y={136}
        type="rectangle"
        size={{ token: 's', ratio: 'portrait' }}
        className="bg-white">
        
        rect portrait
      </Shape>
      <Shape id="shape-circle" x={740} y={296} type="circle" size="l" className="bg-white">
        circle size="l"
      </Shape>
      <Shape id="shape-triangle" x={980} y={304} type="triangle" size={{ widthHeight: 's' }}>
        triangle widthHeight
      </Shape>
      <Shape id="shape-auto" x={795.02868914333} y={508.4503090012408} type="rectangle" size={{ token: 'auto' }}>
        rect auto
      </Shape>

      {/* 4) Markdown: size single-entry (1D/2D) */}
      <Text id="section-markdown" x={40} y={376} fontSize="m" className="font-bold text-slate-700">
        Markdown (size)
      </Text>
      <Node id="md-1d" x={39.01734483672624} y={410}>
        <Markdown size="s">{`
### size="s" (1D)
- text density only
        `}</Markdown>
      </Node>
      <Node id="md-2d-portrait" x={306.01547488853373} y={624.363927626171}>
        <Markdown size={{ token: 'm', ratio: 'portrait' }}>{`
### token + ratio (2D)
- portrait frame
        `}</Markdown>
      </Node>
      <Node id="md-2d-square" x={558.0927247137539} y={423.75717228583244}>
        <Markdown size={{ widthHeight: 'l' }}>{`
### widthHeight (2D)
- square frame
        `}</Markdown>
      </Node>
      <Node id="md-2d-auto" x={620} y={610}>
        <Markdown size={{ token: 'auto' }}>{`
### token auto (2D)
- content-driven frame
        `}</Markdown>
      </Node>

      {/* 5) Sticker: content-driven, inner Text scaling */}
      <Text id="section-sticker" x={924.9132758163689} y={419.2368271840449} fontSize="m" className="font-bold text-slate-700">
        Sticker (Text fontSize in content)
      </Text>

      {/* Text-based sticker sizes */}
      <Sticker id="sticker-text-token-s" x={920} y={455.3062065309499}>
        <Text fontSize="s">text token s</Text>
      </Sticker>
      <Sticker id="sticker-text-token-xl" x={1089.0173448367264} y={462.0807236535086}>
        <Text fontSize="xl">text token xl</Text>
      </Sticker>
      <Sticker id="sticker-text-number" x={920} y={500}>
        <Text fontSize={36}>text number 36</Text>
      </Sticker>

      {/* Emoji-based sticker sizes */}
      <Sticker id="sticker-emoji-token-l" x={1110} y={500}>
        <Text fontSize="l">😎</Text>
      </Sticker>
      <Sticker id="sticker-emoji-huge" x={1030} y={590}>
        <Text fontSize={96}>🤯</Text>
      </Sticker>

      <Text id="sticker-note" x={920} y={700} fontSize="xs" className="text-slate-500">
        Sticker frame is content-driven; inner Text supports token/number sizing.
      </Text>
    </Canvas>);

}