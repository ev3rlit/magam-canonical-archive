import {
  Canvas,
  MindMap,
  Node,
  Sticky,
  Shape,
  Sequence,
  Participant,
  Message,
  Sticker,
  WashiTape,
  Markdown,
  Text,
  preset,
  solid,
  torn,
} from '@magam/core';

/**
 * MindMap Polymorphic Diary (Multiple MindMaps)
 *
 * - 3 sibling MindMaps on one canvas
 * - max depth: 3 (per map)
 * - dense node set with polymorphic children
 */
export default function MindMapDiaryPolymorphic() {
  return (
    <Canvas background="dots">
      <Text id="diary-title" x={80} y={24} className="text-sm tracking-[0.16em] text-slate-500">
        MARCH DIARY BOARD · MULTI MAP
      </Text>

      {/* Canvas seed nodes (dot id keeps cross-scope reference stable) */}
      <Node id="journal.seed" x={70} y={140}>
        <Markdown>{`# 🌱 Journal Seed\n오늘의 감정과 기록`}</Markdown>
      </Node>

      <Node id="habit.seed" x={70} y={610}>
        <Markdown>{`# 🌿 Habit Seed\n리듬과 루틴 관리`}</Markdown>
      </Node>

      <Node id="memory.seed" x={980} y={610}>
        <Markdown>{`# 🌸 Memory Seed\n인상 남긴 순간 모으기`}</Markdown>
      </Node>

      {/* =========================================================
          MindMap A: Daily Journal (depth <= 3)
         ========================================================= */}
      <MindMap id="diary-map" x={280} y={90} layout="bidirectional" spacing={88}>
        {/* level 1 */}
        <Sticky id="day-summary" from="journal.seed" width={320} pattern={preset('lined-warm')}>
          <Markdown>{`
# 03/03 Tue

느리게 시작했지만 오후엔 집중이 올라왔다.
- 산책 20분 ✅
- 글 2페이지 ✅
- 물 6잔 ✅
          `}</Markdown>
        </Sticky>

        {/* level 2 */}
        <Sticky
          id="gratitude"
          from={{
            node: 'day-summary',
            edge: {
              label: { text: '감사', color: '#ffffff', bg: '#f59e0b', fontSize: 12 },
              stroke: '#f59e0b',
              pattern: 'dashed',
            },
          }}
          width={255}
          pattern={preset('postit')}
        >
          <Markdown>{`
## 🙏 Thanks
- 따뜻한 햇빛
- 잔잔한 음악
- 끝까지 써낸 집중력
          `}</Markdown>
        </Sticky>

        <Shape
          id="focus-card"
          type="rectangle"
          from={{
            node: 'day-summary',
            edge: {
              label: { text: '오늘의 초점', color: '#ffffff', bg: '#2563eb', fontSize: 12 },
              stroke: '#2563eb',
              type: 'curved',
            },
          }}
          className="bg-sky-50 border-sky-200"
        >
          <Markdown>{`### 🎯 Focus\n오전 90분은 초안 완성에만 사용하기`}</Markdown>
        </Shape>

        <Node
          id="energy-note"
          from={{
            node: 'day-summary',
            edge: { label: '컨디션', stroke: '#06b6d4', pattern: 'dotted' },
          }}
        >
          <Markdown>{`### 🔋 Energy\n아침 4/10 → 오후 7/10`}</Markdown>
        </Node>

        <WashiTape
          id="mint-tape"
          from={{
            node: 'day-summary',
            edge: {
              label: { text: '꾸미기', bg: '#a7f3d0', color: '#065f46', fontSize: 11 },
              stroke: '#34d399',
            },
          }}
          pattern={solid('#bbf7d0')}
          edge={torn(0.9)}
          opacity={0.82}
        />

        {/* level 3 */}
        <Sequence
          id="night-routine"
          from={{
            node: 'focus-card',
            edge: {
              label: { text: '밤 루틴', color: '#111827', bg: '#d1fae5', fontSize: 12 },
              stroke: '#10b981',
              pattern: 'dotted',
              type: 'step',
            },
          }}
          participantSpacing={145}
          messageSpacing={50}
          className="rounded-lg border border-emerald-100 bg-white/80 p-3"
        >
          <Participant id="me" label="Me" />
          <Participant id="journal" label="Journal" />
          <Participant id="tomorrow" label="Tomorrow" />
          <Message from="me" to="journal" label="오늘 정리" />
          <Message from="journal" to="tomorrow" label="내일 목표 1개" />
          <Message from="tomorrow" to="me" label="한 줄 다짐" type="reply" />
        </Sequence>

        <Node
          id="tomorrow-note"
          from={{
            node: 'focus-card',
            edge: { label: '내일 메모', stroke: '#8b5cf6', pattern: 'dashed' },
          }}
        >
          <Markdown>{`### 📌 Tomorrow\n1. 초안 마무리\n2. 운동 30분\n3. 22:30 취침`}</Markdown>
        </Node>

        <Sticker id="star-pin" from="gratitude" rotation={-7}>
          ⭐
        </Sticker>

        <Shape
          id="energy-fix"
          type="rectangle"
          from={{
            node: 'energy-note',
            edge: { label: '개선', stroke: '#0ea5e9', type: 'step' },
          }}
          className="bg-cyan-50 border-cyan-200"
        >
          <Markdown>{`### 🧊 Boost\n물 1잔 + 10분 스트레칭`}</Markdown>
        </Shape>
      </MindMap>

      {/* =========================================================
          MindMap B: Habit Loop (depth <= 3)
         ========================================================= */}
      <MindMap id="habit-map" x={280} y={520} layout="tree" spacing={78}>
        {/* level 1 */}
        <Sticky id="habit-root" from="habit.seed" width={280} pattern={preset('grid-standard')}>
          <Markdown>{`# 🗓 Habit Loop\n지속 가능한 루틴 만들기`}</Markdown>
        </Sticky>

        {/* level 2 */}
        <Node id="morning" from={{ node: 'habit-root', edge: { label: '아침', stroke: '#f97316' } }}>
          <Markdown>{`### ☀️ Morning\n기상 · 물 · 스트레칭`}</Markdown>
        </Node>

        <Node id="work-block" from={{ node: 'habit-root', edge: { label: '업무', stroke: '#2563eb' } }}>
          <Markdown>{`### 💻 Work\n집중 블록 2회`}</Markdown>
        </Node>

        <Sticky id="health" from={{ node: 'habit-root', edge: { label: '건강', stroke: '#16a34a' } }} pattern={preset('dot-grid')}>
          <Markdown>{`## 🥗 Health\n식사 · 물 · 걷기`}</Markdown>
        </Sticky>

        <Shape
          id="social"
          type="rectangle"
          from={{ node: 'habit-root', edge: { label: '관계', stroke: '#db2777', pattern: 'dashed' } }}
          className="bg-pink-50 border-pink-200"
        >
          <Markdown>{`### 💬 Social\n짧은 안부 1회`}</Markdown>
        </Shape>

        {/* level 3 */}
        <Sticker id="wake-check" from="morning">⏰</Sticker>
        <Node id="morning-water" from="morning">
          <Markdown>{`### 💧 Water\n기상 후 1컵`}</Markdown>
        </Node>

        <Sequence
          id="work-flow"
          from={{ node: 'work-block', edge: { label: '흐름', stroke: '#2563eb', type: 'step' } }}
          participantSpacing={120}
          messageSpacing={44}
          className="rounded-lg border border-blue-100 bg-white/80 p-2"
        >
          <Participant id="plan" label="Plan" />
          <Participant id="do" label="Do" />
          <Participant id="review" label="Review" />
          <Message from="plan" to="do" label="90분 집중" />
          <Message from="do" to="review" label="완료 점검" />
        </Sequence>

        <WashiTape
          id="health-tape"
          from={{ node: 'health', edge: { label: '강조', stroke: '#22c55e', pattern: 'dotted' } }}
          pattern={solid('#dcfce7')}
          edge={torn(0.7)}
          opacity={0.8}
        />

        <Node id="social-note" from="social">
          <Markdown>{`### 📨 Note\n가벼운 안부 메시지 전송`}</Markdown>
        </Node>
      </MindMap>

      {/* =========================================================
          MindMap C: Memory & Weekend Plan (depth <= 3)
         ========================================================= */}
      <MindMap id="memory-map" x={950} y={480} layout="bidirectional" spacing={84}>
        {/* level 1 */}
        <Sticky id="memory-root" from="memory.seed" width={300} pattern={preset('kraft-natural')}>
          <Markdown>{`# 📸 Memory Board\n이번 주의 장면과 계획`}</Markdown>
        </Sticky>

        {/* level 2 */}
        <Node id="highlight" from={{ node: 'memory-root', edge: { label: '하이라이트', stroke: '#a855f7' } }}>
          <Markdown>{`### ✨ Highlight\n벚꽃길 산책 40분`}</Markdown>
        </Node>

        <Shape
          id="weekend-plan"
          type="rectangle"
          from={{ node: 'memory-root', edge: { label: '주말', stroke: '#f43f5e', pattern: 'dashed' } }}
          className="bg-rose-50 border-rose-200"
        >
          <Markdown>{`### 🌤 Weekend\n토: 브런치 / 일: 전시`}</Markdown>
        </Shape>

        <Sticky id="photo-list" from={{ node: 'memory-root', edge: { label: '사진', stroke: '#0891b2' } }} pattern={preset('pastel-dots')}>
          <Markdown>{`## 🧷 Shot List\n- 카페 창가\n- 노을 하늘\n- 책상 디테일`}</Markdown>
        </Sticky>

        <Node id="reflection" from={{ node: 'memory-root', edge: { label: '회고', stroke: '#16a34a' } }}>
          <Markdown>{`### 🪞 Reflection\n작은 만족을 더 자주 기록하기`}</Markdown>
        </Node>

        {/* level 3 */}
        <Sticker id="highlight-star" from="highlight">🌟</Sticker>

        <WashiTape
          id="weekend-tape"
          from={{ node: 'weekend-plan', edge: { label: '포인트', stroke: '#fb7185', type: 'curved' } }}
          pattern={solid('#fecdd3')}
          edge={torn(0.85)}
          opacity={0.84}
        />

        <Shape id="photo-pack" type="rectangle" from="photo-list" className="bg-cyan-50 border-cyan-200">
          <Markdown>{`### 🗂 Pack\n보조배터리 · 필름카메라`}</Markdown>
        </Shape>

        <Node id="next-week-note" from="reflection">
          <Markdown>{`### 📅 Next Week\n화/목 저녁 20분 산책 고정`}</Markdown>
        </Node>
      </MindMap>
    </Canvas>
  );
}
