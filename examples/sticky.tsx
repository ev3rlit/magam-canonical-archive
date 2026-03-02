import {
  anchor,
  attach,
  Canvas,
  polar,
  preset,
  segment,
  solid,
  Sticky,
  Sticker,
  Text,
  texture,
  torn,
  WashiTape,
  Image,
  Markdown,
  svg,
} from '@magam/core';

/**
 * Sticky + WashiTape Showcase: Journaling Edition
 *
 * Covers:
 * - Diary entry on lined paper with washi tape
 * - To-Do list on classic postit
 * - Gratitude note on kraft paper
 * - Weekly mood tracker with emoji
 * - Habit tracker table on grid paper
 * - Polaroid-style photo frame
 * - Decorative stickers and washi tapes throughout
 */
export default function StickyShowcase() {
  const polaroidSvg =
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="240" height="180" viewBox="0 0 240 180">
        <rect width="240" height="180" fill="#f0ebe3" rx="2" />
        <rect x="16" y="12" width="208" height="130" fill="#d4e8d0" rx="1" />
        <circle cx="80" cy="60" r="22" fill="#f7d794" opacity="0.9" />
        <path d="M40 142 Q80 80 120 110 Q160 80 200 142 Z" fill="#6ab04c" opacity="0.7" />
        <path d="M60 142 Q90 100 130 120 Q170 95 210 142 Z" fill="#78b35a" opacity="0.5" />
        <circle cx="170" cy="50" r="5" fill="#fff" opacity="0.6" />
        <circle cx="180" cy="42" r="3" fill="#fff" opacity="0.4" />
        <text x="120" y="168" text-anchor="middle" font-size="11" fill="#8b7355" font-family="serif" font-style="italic">
          spring walk
        </text>
      </svg>
    `);

  return (
    <Canvas background={{
        gap: 4,
        pattern: ({ size }) => `
          <line x1="0" y1="${size}" x2="${size}" y2="${size}" stroke="rgba(180,160,130,0.08)" stroke-width="0.5" />
          <line x1="${size}" y1="0" x2="${size}" y2="${size}" stroke="rgba(180,160,130,0.08)" stroke-width="0.5" />
        `,
      }}>
      {/* === Title === */}
      <Text id="bg-title" x={80} y={30} className="text-lg font-light text-[#8b7355] tracking-[0.15em]">
        My Journal  2026.03.02
      </Text>

      <Sticker id="s-sparkle" x={380} y={24}>✨</Sticker>

      {/* ============================================
          1. Diary Entry — Lined Warm
          ============================================ */}
      <Sticky
        id="diary"
        x={80}
        y={80}
        width={340}
        height={280}
        shape="rectangle"
        pattern={preset('lined-warm')}
      >
        <Markdown>{`
# 📝 Today's Diary

The weather was really lovely today.
I went to the neighborhood cafe at lunch
and sipped a latte while watching cherry blossoms bloom outside.

In the afternoon I organized ideas for a new project.
I have a good feeling about this one 🌸
        `}</Markdown>
      </Sticky>

      {/* Washi tape on diary — purple */}
      <WashiTape
        id="t-diary"
        at={attach({ target: 'diary', placement: 'top', span: 0.4, align: 0.15, offset: 4, thickness: 22 })}
        pattern={solid('#9b8ec4')}
        edge={torn(1.2)}
        opacity={0.88}
      />

      {/* ============================================
          2. To-Do List — Post-it
          ============================================ */}
      <Sticky
        id="todo"
        x={480}
        y={80}
        width={260}
        height={260}
        shape="rectangle"
        pattern={preset('postit')}
      >
        <Markdown>{`
# ✅ To-Do List

- [x] Morning workout 30 min 💪
- [x] Read 20 pages 📖
- [ ] Groceries (milk, eggs, fruit)
- [ ] Call Mom 📞
- [ ] Draft blog post
- [x] Hang the laundry 🧺
        `}</Markdown>
      </Sticky>

      {/* Rainbow washi tape on todo — top */}
      <WashiTape
        id="t-todo-top"
        at={attach({ target: 'todo', placement: 'top', span: 0.5, align: 0.5, offset: 4, thickness: 20 })}
        pattern={svg({
          markup: `
            <svg xmlns="http://www.w3.org/2000/svg" width="60" height="20" viewBox="0 0 60 20">
              <rect width="10" height="20" x="0" fill="#ff6b6b" />
              <rect width="10" height="20" x="10" fill="#ffa502" />
              <rect width="10" height="20" x="20" fill="#ffd93d" />
              <rect width="10" height="20" x="30" fill="#6bcb77" />
              <rect width="10" height="20" x="40" fill="#4d96ff" />
              <rect width="10" height="20" x="50" fill="#9b59b6" />
            </svg>
          `,
        })}
        edge={torn(1.0)}
        opacity={0.85}
      />

      {/* Pink washi tape on todo — bottom right */}
      <WashiTape
        id="t-todo-btm"
        at={attach({ target: 'todo', placement: 'bottom', span: 0.3, align: 0.85, offset: -4, thickness: 18 })}
        pattern={solid('#f8a5c2')}
        edge={torn(0.8)}
        opacity={0.8}
      />

      {/* ============================================
          3. Gratitude — Kraft Natural
          ============================================ */}
      <Sticky
        id="gratitude"
        at={anchor('todo', { position: 'bottom', gap: 30 })}
        width={240}
        shape="rectangle"
        pattern={preset('kraft-natural')}
      >
        <Markdown>{`
# 🙏 Grateful For

1. A delicious cup of coffee ☕
2. Sunny weather & cherry blossoms 🌸
3. A healthy day 💚
4. Friends who cheer me on
        `}</Markdown>
      </Sticky>

      {/* Blue pin sticker on gratitude */}
      <Sticker id="s-pin" anchor="gratitude" position="top-right" gap={-8} rotation={12}>
        📌
      </Sticker>

      {/* ============================================
          4. Weekly Mood — Grid Standard
          ============================================ */}
      <Sticky
        id="mood"
        at={anchor('diary', { position: 'bottom', gap: 40 })}
        width={320}
        height={180}
        shape="rectangle"
        pattern={preset('grid-standard')}
      >
        <Markdown>{`
# 🌈 Weekly Mood

| Mon | Tue | Wed | Thu | Fri | Sat | Sun |
|-----|-----|-----|-----|-----|-----|-----|
| 😊 | 😴 | 🥰 | 😤 | 😌 | 🤩 | 😊 |
        `}</Markdown>
      </Sticky>

      {/* Decorative washi across mood card — mint */}
      <WashiTape
        id="t-mood"
        at={attach({ target: 'mood', placement: 'top', span: 0.35, align: 0.8, offset: 6, thickness: 20 })}
        pattern={solid('#7ed6df')}
        edge={torn(1.0)}
        opacity={0.82}
      />

      {/* ============================================
          5. Polaroid Photo
          ============================================ */}
      <Sticker id="photo" x={200} y={690} rotation={3}>
        <Image src={polaroidSvg} alt="Spring Walk" width={200} height={150} />
      </Sticker>

      <Text
        id="photo-caption"
        anchor="photo"
        position="bottom"
        gap={8}
        className="text-sm italic text-[#8b7355] font-serif"
      >
        Spring Walk 🌷
      </Text>

      {/* Tape on polaroid corner */}
      <WashiTape
        id="t-photo"
        at={segment({ x: 220, y: 680 }, { x: 280, y: 695 }, { thickness: 16 })}
        pattern={solid('#e1d0b3')}
        edge={torn(0.6)}
        opacity={0.75}
      />

      {/* ============================================
          6. Habit Tracker — Grid Fine
          ============================================ */}
      <Sticky
        id="habit"
        at={anchor('gratitude', { position: 'bottom', gap: 30 })}
        width={280}
        height={220}
        shape="rectangle"
        pattern={preset('grid-fine')}
      >
        <Markdown>{`
# 📊 Habit Tracker

| Habit | Mon | Tue | Wed | Thu | Fri |
|-------|-----|-----|-----|-----|-----|
| Exercise | ✅ | ✅ | ❌ | ✅ | ✅ |
| Reading | ✅ | ❌ | ✅ | ✅ | ✅ |
| Meditate | ✅ | ✅ | ✅ | ❌ | ✅ |
| Journal | ✅ | ✅ | ✅ | ✅ | ✅ |
        `}</Markdown>
      </Sticky>

      {/* Masking tape on habit tracker */}
      <WashiTape
        id="t-habit"
        at={attach({ target: 'habit', placement: 'top', span: 0.4, align: 0.5, offset: 4, thickness: 22 })}
        pattern={preset('masking-solid')}
        edge={torn(1.0)}
        opacity={0.85}
      />

      {/* ============================================
          Decorative Stickers
          ============================================ */}
      <Sticker id="s-flower1" x={440} y={60}>🌷</Sticker>
      <Sticker id="s-leaf" x={750} y={90} rotation={-10}>🍃</Sticker>
      <Sticker id="s-heart" x={425} y={350} rotation={8}>💕</Sticker>
      <Sticker id="s-star" x={760} y={400}>⭐</Sticker>
      <Sticker id="s-coffee" x={60} y={380}>☕</Sticker>
      <Sticker id="s-music" x={750} y={580} rotation={-5}>🎵</Sticker>

      {/* Decorative banner washi tape — brown */}
      <WashiTape
        id="t-banner"
        at={polar(80, 570, -3, 260, { thickness: 26 })}
        pattern={solid('#a18d6d')}
        texture={texture({ opacity: 0.1, blendMode: 'multiply' })}
        edge={torn(0.8)}
        text={{ align: 'center', color: '#fcfaf8', size: 11 }}
      >
        You did great today ♡
      </WashiTape>

      {/* Small label sticker */}
      <Sticker id="s-hashtag" x={400} y={580} rotation={-4}>
        <Text className="text-[10px] font-mono text-[#a18d6d] border border-[#a18d6d] px-2 py-1 bg-[#fefcf7]">#journal</Text>
      </Sticker>
    </Canvas>
  );
}
