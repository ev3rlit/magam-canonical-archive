# Quickstart: Washi Tape Implementation

## 목적

`001-add-washi-tape` 기능을 로컬에서 빠르게 구현/검증하기 위한 최소 실행 순서.

## 1) 준비

```bash
cd /Users/danghamo/Documents/gituhb/magam-washi-tape
git checkout 001-add-washi-tape
bun install
```

## 2) 구현 순서

1. 코어 컴포넌트 추가
   - `libs/core/src/components/WashiTape.tsx` 신규 생성
   - `libs/core/src/index.ts` export 추가
2. 앱 파서 매핑 추가
   - `app/app/page.tsx`에 `graph-washi-tape` 분기 추가
   - `washi-tape` 노드 데이터 정규화(`at -> resolvedGeometry`, `pattern` fallback)
3. 노드 렌더러 추가
   - `app/components/nodes/WashiTapeNode.tsx` 신규 생성
   - `app/components/GraphCanvas.tsx`의 `nodeTypes`에 `washi-tape` 등록
4. 유틸 추가
   - `app/utils/washiTapeGeometry.ts`: segment/polar/attach 정규화
   - `app/utils/washiTapePattern.ts`: preset/custom/fallback/검증
   - `app/utils/washiTapeDefaults.ts`: 기본값/범위 보정
5. WS 편집 경로 확장
   - `app/ws/methods.ts`의 허용 타입 목록에 `washi-tape` 추가
   - `app/ws/filePatcher.ts`의 create 분기에 `WashiTape` JSX 생성 추가
6. 서버 sourceMeta 확장
   - `libs/cli/src/server/http.ts`의 `injectSourceMeta`에 `graph-washi-tape` 포함

## 3) 테스트

```bash
# 코어 host 렌더 테스트
bun test libs/core/src/__tests__/washi-tape.spec.tsx

# 앱 유틸/파서 단위 테스트
bun test app/utils/washiTapeGeometry.test.ts app/utils/washiTapePattern.test.ts

# WS 계약 테스트
bun test app/ws/methods.test.ts app/ws/filePatcher.test.ts

# 기존 회귀(스티커 + export)
bun test libs/core/src/__tests__/sticker.spec.tsx app/utils/pdfGolden.test.ts
```

## 4) 수동 검증

1. `bun run dev`로 앱 실행 후 샘플 문서에서 와시 테이프 삽입.
2. preset, solid, svg, image 패턴 각각 렌더 확인.
3. `segment`, `polar`, `attach` 배치별 결과 확인.
4. 대상 노드 이동 시 attach 상대 위치 유지 확인.
5. PNG/JPEG/SVG/PDF 내보내기 후 캔버스와 시각 일치 확인.

## 5) 완료 기준 체크

- save/reopen 후 와시 테이프 속성 보존.
- invalid pattern 입력 시 크래시 없이 fallback 렌더.
- `sticker` 기존 테스트 회귀 없음.
- v1 비목표(직접 편집 핸들/전용 Inspector 미제공) 유지.

## 6) 검증 실행 결과 (2026-03-01)

실행한 명령:

```bash
bun test libs/core/src/__tests__/washi-tape.spec.tsx \
  app/ws/methods.test.ts \
  app/ws/filePatcher.test.ts \
  app/utils/washiTapePattern.test.ts \
  app/utils/washiTapeGeometry.test.ts \
  app/components/nodes/WashiTapeNode.test.tsx \
  app/store/graph.test.ts \
  app/utils/clipboardGraph.test.ts \
  app/utils/anchorResolver.test.ts \
  app/components/ui/QuickOpenDialog.test.ts \
  app/utils/pdfGolden.test.ts
```

결과:

- 위 테스트 세트 기준 PASS.
- `bunx tsc -p libs/cli/tsconfig.json --noEmit` PASS.
- `bunx tsc -p app/tsconfig.json --noEmit`은 기존 `app/app/api/assets/upload/route.spec.ts`의 `Buffer`/`BlobPart` 타입 이슈 1건으로 실패(와시 변경과 무관).
