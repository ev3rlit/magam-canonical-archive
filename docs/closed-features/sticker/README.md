# 스티커 기능 PRD

## 1) 배경

Magam 캔버스는 현재 이미지/텍스트/도형을 개별 오브젝트로 표현할 수 있지만, "실물 스티커를 붙인 느낌"의 시각 언어는 제공하지 않습니다.  
사용자는 핵심 정보 강조, 감정/톤 표현, 빠른 코멘트 용도로 스티커 스타일을 원하며, 특히 이미지 기반 스티커(투명 배경 기준 외곽선), 텍스트 스티커, 이모지 스티커를 동일한 작업 흐름에서 다루고 싶어 합니다.

또한 스티커도 일반 캔버스 오브젝트처럼 배치/이동/정렬/내보내기가 가능해야 하며, 기존 `anchor` 기반 배치 시스템과 호환되어야 합니다.

## 2) 문제 정의

- 이미지를 강조하려면 사용자가 수동으로 도형과 그림자 효과를 조합해야 하므로 작업 비용이 큽니다.
- 텍스트/이모지를 스티커처럼 표현하는 공통 컴포넌트가 없어 화면 일관성이 깨집니다.
- 오브젝트 모델이 분리되어 있으면 anchor 기반 레이아웃에서 스티커 배치가 불안정해집니다.
- 스타일 목적(가벼운 강조, 메모, 상태 표시)에 비해 작성 절차가 복잡합니다.

핵심 문제는 "스티커를 1급 캔버스 오브젝트로 다루는 표준이 없다"는 점입니다.

## 3) 목표와 비목표

### 목표

- 이미지/텍스트/이모지 3종 스티커를 하나의 기능으로 제공
- 이미지 스티커에 실물 느낌의 아웃라인(컷라인)과 그림자 적용
- 이미지 스티커 입력 포맷으로 SVG를 공식 지원
- 스티커를 캔버스 오브젝트로 배치/이동/리사이즈/회전 가능
- 기존 anchor 기능(`anchor`, `position`, `gap`)과 호환
- 내보내기(PNG/JPEG/SVG/PDF) 시 시각 결과를 최대한 동일하게 유지

### 비목표

- AI 배경 제거/피사체 자동 분리
- 스티커 마켓/에셋 스토어
- 벡터 편집기 수준의 패스 수동 편집
- 물리 시뮬레이션(찢김, 구김, 반사 애니메이션)

## 4) 사용자 시나리오

1. 사용자가 PNG 또는 SVG 이미지를 추가하면 흰색 아웃라인이 적용된 이미지 스티커가 캔버스에 배치된다.
2. 사용자가 "TODO" 텍스트 스티커를 추가하고 회전/크기 조절로 강조 라벨처럼 사용한다.
3. 사용자가 이모지 스티커(예: 🔥, ✅)를 노드 주변에 붙여 상태 신호를 표시한다.
4. 사용자가 스티커에 `anchor="node-A"`를 지정하면 대상 노드 이동 시 스티커가 지정된 상대 위치를 유지한다.
5. 사용자가 결과를 이미지/PDF로 내보내면 스티커 아웃라인과 그림자가 화면과 동일하게 반영된다.

## 5) 기능 요구사항

### FR-1. 스티커 오브젝트 모델

- 신규 오브젝트 타입 `sticker` 도입
- 공통 속성: `id`, `kind(image|text|emoji)`, `x`, `y`, `width`, `height`, `rotation`, `zIndex`
- anchor 배치 속성 지원: `anchor`, `position`, `gap`, `align`
- 기존 저장 포맷(JSON/TSX/문서 모델)에서 직렬화/역직렬화 가능

수용 기준

- [AC-01] 스티커는 캔버스 오브젝트 목록에서 독립 타입으로 조회된다.
- [AC-02] 저장 후 재로드 시 위치/크기/회전/anchor 값이 보존된다.

### FR-2. 이미지 스티커 아웃라인 렌더링

- 이미지 알파 경계를 기반으로 외곽선을 렌더링
- 기본 스타일: 흰색 아웃라인 + 부드러운 그림자 + 약한 스티커 보더
- 아웃라인 두께/색상/그림자 강도는 속성으로 조절 가능
- 투명 배경이 없는 이미지도 최소 보더를 적용해 스티커 느낌 제공
- 입력 포맷: `png`, `jpg`, `jpeg`, `webp`, `gif`, `svg`
- SVG 입력은 벡터 해상도 이점을 유지하며 렌더 파이프라인에 통합

수용 기준

- [AC-03] 투명 배경 PNG 입력 시 피사체 외곽을 따라 아웃라인이 생성된다.
- [AC-04] JPG 입력 시 사각형 보더 + 그림자 기반 스티커 스타일이 적용된다.
- [AC-05] 아웃라인 두께 변경이 즉시 렌더에 반영된다.
- [AC-16] SVG 입력 시 캔버스 렌더와 내보내기 결과 모두에서 스티커 스타일이 유지된다.

### FR-3. 텍스트 스티커

- `text` 값 입력 시 텍스트 기반 스티커 생성
- 폰트 크기, 굵기, 텍스트 색, 배경색, 보더 색, 패딩 조절
- 길이가 긴 텍스트는 줄바꿈 또는 최대 폭 규칙으로 안전 처리

수용 기준

- [AC-06] 텍스트 변경 시 스티커 크기 또는 줄바꿈 레이아웃이 안정적으로 갱신된다.
- [AC-07] 텍스트 스티커도 이미지 스티커와 동일한 오브젝트 조작(이동/회전/anchor)을 지원한다.

### FR-4. 이모지 스티커

- 단일/복수 이모지 입력 지원
- 크기, 배경, 아웃라인, 그림자 커스터마이징 지원
- 플랫폼 폰트 차이에도 레이아웃이 깨지지 않도록 최소 박스 기준 적용

수용 기준

- [AC-08] 대표 이모지(✅, 🔥, 🚀) 렌더가 캔버스 확대/축소 시 깨지지 않는다.
- [AC-09] 이모지 스티커가 텍스트/이미지 스티커와 동일한 조작 인터랙션을 사용한다.

### FR-5. 캔버스 인터랙션

- 생성, 선택, 드래그 이동, 리사이즈, 회전, 복제, 삭제 지원
- 정렬 가이드/스냅/레이어 순서 변경 지원
- 다중 선택 및 그룹 동작 호환

수용 기준

- [AC-10] 최소 50개 스티커가 있는 캔버스에서 기본 조작이 기능적으로 문제 없이 동작한다.
- [AC-11] 복사/붙여넣기 시 스티커 타입 및 스타일 속성이 그대로 유지된다.

### FR-6. Anchor 연동

- 스티커에 `anchor` 지정 가능
- `position`(top/bottom/left/right 등)과 `gap`으로 상대 배치
- 기존 anchor 해석 규칙(스코프 해석 포함) 재사용

수용 기준

- [AC-12] anchor 대상 이동 시 스티커가 상대 위치를 유지한다.
- [AC-13] 스코프가 있는 문맥에서 anchor id 해석이 기존 노드/도형과 동일 규칙으로 동작한다.

### FR-7. 내보내기/호환성

- PNG/JPEG/SVG/PDF 내보내기에서 스티커 스타일 유지
- 미지원 속성은 무시하되 렌더 실패 없이 fallback 처리

수용 기준

- [AC-14] 내보낸 결과물에서 스티커 아웃라인과 그림자가 눈에 띄게 누락되지 않는다.
- [AC-15] 구버전 문서 로드 시 스티커 미존재 상태에서도 앱이 오류 없이 열린다.

## 6) 비기능 요구사항

- 성능: 100개 스티커가 있는 장면에서 기본 이동/선택 인터랙션이 체감 지연 없이 동작
- 안정성: 스티커 생성/편집/삭제/undo-redo 플로우에서 데이터 손실 0건
- 접근성: 키보드 포커스 선택 가능, Inspector에서 속성 편집 가능
- 유지보수성: 스티커 타입(kind) 추가 시 공통 렌더/속성 파이프라인 재사용 가능

## 7) UX 제안

- 삽입 진입점: `Sticker` 도구 버튼 또는 명령 팔레트
- 생성 선택: `Image Sticker`, `Text Sticker`, `Emoji Sticker`
- 기본 프리셋
- `Image`: outline 8px, white, shadow medium
- `Text`: rounded background + outline 4px
- `Emoji`: circle/rounded background + outline 4px
- 우측 Inspector에서 공통 속성(위치/크기/회전/anchor)과 타입별 속성(텍스트, 이모지, 이미지 소스) 노출

## 8) 기술 설계 개요

### 제안 컴포넌트 인터페이스

```tsx
<Sticker
  id="sticker-1"
  kind="image"
  src="./assets/images/cat.png"
  x={320}
  y={180}
  width={180}
  outlineWidth={8}
  outlineColor="#ffffff"
  shadow="md"
  anchor="node-a"
  position="right"
  gap={16}
/>
```

```tsx
<Sticker
  id="sticker-2"
  kind="text"
  text="TODO"
  x={120}
  y={90}
  fontSize={24}
  bgColor="#FFE15D"
  outlineWidth={4}
/>
```

```tsx
<Sticker
  id="sticker-3"
  kind="emoji"
  emoji="🔥"
  x={540}
  y={120}
  fontSize={42}
  outlineWidth={4}
/>
```

### 렌더 파이프라인(이미지 스티커)

1. 원본 이미지 로드(PNG/JPG/SVG 등)
2. 래스터 입력은 알파 마스크 추출, SVG 입력은 벡터 경계 기반 외곽선 계산
3. 마스크/경계 확장(dilate/offset) 기반 외곽선 생성
4. 외곽선 + 그림자 + 원본 이미지 합성
5. 확대/축소 시 경계가 깨지지 않도록 해상도/스케일 규칙 적용

## 9) 단계별 구현 계획

1. 데이터 모델/컴포넌트 추가
- `Sticker` 타입 및 직렬화 스키마 정의
- 코어 컴포넌트/렌더러 호스트(`graph-sticker`) 연결

2. 3종 스티커 렌더 구현
- image/text/emoji 분기 렌더
- 기본 프리셋 및 타입별 속성 적용

3. 캔버스 편집 연동
- 선택/이동/리사이즈/회전/복제/삭제
- Inspector 속성 편집 UI 연결

4. Anchor/레이아웃 통합
- 기존 anchor 해석 체계 재사용
- 스코프 포함 케이스 회귀 테스트 추가

5. 내보내기/품질 마감
- PNG/JPEG/SVG/PDF 출력 검증
- 성능/회귀/호환성 테스트 완료

## 10) 성공 지표

- 스티커 기능 사용 세션 비율 25% 이상
- 문서당 평균 강조 요소(스티커) 사용량 증가
- 스티커 관련 렌더 오류율 1% 미만
- 스티커 작업 완료까지 클릭/작업 시간 감소(기존 수동 조합 대비)

## 11) 리스크 및 대응

- 알파 경계 계산 비용 증가
- 대응: 캐시 + 해상도 단계화 + 비동기 처리

- 플랫폼별 이모지 렌더 차이
- 대응: 최소 박스/라인 높이 규칙, fallback 폰트 정책

- 내보내기 엔진별 그림자 표현 차이
- 대응: 엔진별 캡처 테스트 골든 이미지 운영

## 12) 오픈 질문

- 1차 릴리스에서 스티커 회전 범위를 자유(0~360)로 열지, 스냅 각도(예: 15도) 중심으로 제한할지?
- 텍스트 스티커의 기본 폰트 정책(제품 기본 폰트 vs 스티커 전용 스타일)을 분리할지?
- 이미지 스티커 아웃라인 알고리즘을 클라이언트 실시간 계산으로 할지, 자산 저장 시 프리프로세싱할지?

## 13) 구현 체크리스트 / 실행 로그 (TASK-STK)

- [x] TASK-STK-13(진행): 복사 시 선택 노드 JSON payload에 sticker 필드(kind/src/text/emoji/style) 보존 + 붙여넣기 시 sticker 데이터 보존/ID 재매핑 + 붙여넣기 기준 undo/redo 스냅샷 복원
- [x] TASK-STK-14/15: sticker id 스코프 반영 + anchor 스코프 해석 회귀 테스트 추가
- [x] TASK-STK-16(진행): core renderer 레벨에서 PNG/JPG/SVG/PDF 타겟 공통 sticker style host props 보존 회귀 테스트 추가
- [x] TASK-STK-17: export 엔진 실사용 경로 보정 및 포맷 확장 (PNG/JPG/SVG/PDF)
- [x] TASK-STK-18: 최소 Sticker Inspector UI 추가 (선택된 sticker 실시간 편집)
- [ ] TASK-STK-19: 삽입 프리셋 엔트리 미구현
- [x] TASK-STK-20(부분): 테스트 실행 로그/증거 파일 경로 갱신

### 테스트 로그 (AC 매핑)

- AC-12/13: `libs/core/src/__tests__/embedScope.spec.tsx`
  - Sticker anchor scope 해석 케이스 추가 (기존 유지)
- AC-16: `libs/core/src/__tests__/sticker.spec.tsx`
  - PNG/JPG/SVG/PDF 타겟에 대해 sticker host props(src/outline/shadow/padding) 보존 회귀 케이스 확장
- AC-11: `app/utils/stickerDefaults.test.ts`
  - sticker 스타일 필드 정규화/보존 케이스 추가 (기존 유지)
- TASK-STK-13 보강: `app/utils/clipboardGraph.ts`, `app/utils/clipboardGraph.test.ts`, `app/components/GraphCanvas.tsx`
  - 붙여넣기 시 노드/엣지 ID 재매핑, sticker data 유지, 붙여넣기 기준 undo/redo 복원 흐름 추가

### 테스트 실행 상태 (2026-02-17)

- ✅ `bun test libs/core/src/__tests__/sticker.spec.tsx`
- ✅ `bun test app/utils/stickerDefaults.test.ts app/utils/clipboardGraph.test.ts`
- ⚠️ 전체 워크스페이스 테스트(`bun test`)는 기존 환경/무관 영역 이슈 가능성으로 미실행 (스티커 범위 타깃 테스트 위주 검증)


### TASK-STK-17 실제 검증 범위 (2026-02-17 추가)

**검증됨**
- PNG/JPG/SVG: `useExportImage` 실제 캡처 경로에서 sticker 노드 스타일(외곽선/패딩/회전/shadow class) 유지
- PDF: 동일 캡처 경로를 PNG로 생성 후 jsPDF 임베딩하여 다운로드 지원 (시각 기준은 PNG 캡처 결과와 동일)
- ExportDialog 포맷 선택에 `pdf` 추가

**미검증 / 리스크**
- 브라우저/OS 별 PDF 뷰어 렌더 차이(특히 그림자 안티앨리어싱)까지의 픽셀 단위 골든 비교는 미실행
- 대형 캔버스(고해상도/노드 다수)에서 PDF 메모리 사용량 회귀는 별도 부하 테스트 필요

### TASK-STK-18 실제 검증 범위 (2026-02-17 추가)

**검증됨**
- 선택된 sticker 대상 Inspector 표시
- core 편집 필드: `kind`, `text/emoji/src`, `outlineWidth`, `outlineColor`, `shadow`, `bgColor`, `textColor`, `fontSize`, `padding`, `rotation`
- 변경 즉시 selected sticker 반영 + zustand nodes state(`updateNodeData`)에 유지

**미검증 / 리스크**
- 파일 원본(.tsx) 역직렬화-저장 round-trip 영속화는 아직 미연결 (현재는 런타임 state 기준)
- 다중 sticker 동시 편집 UX(우선순위/배치 편집)는 미지원
