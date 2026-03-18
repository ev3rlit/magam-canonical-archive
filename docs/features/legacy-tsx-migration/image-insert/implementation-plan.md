# Image Insert 구현 계획 (Magam)

## 1. 문서 목적과 범위

이 문서는 `/Users/danghamo/Documents/gituhb/graphwritev2/docs/features/image-insert/README.md` PRD를 구현 가능한 작업 단위로 분해한 실행 계획이다.

- 대상 범위: 이미지 삽입 v1 (파일/URL/클립보드/드래그앤드롭 + node/markdown/canvas/shape 삽입 모드)
- 비범위: 이미지 편집(크롭/필터), 외부 클라우드 스토리지 연동, 동시 편집 충돌 해결
- 핵심 성공 조건: AC-01~AC-11 충족 + 비기능 요구사항(성능/보안/안정성) 달성

---

## 2. 구현 원칙

1. 4개 입력 경로를 단일 파이프라인으로 통합한다.
2. 바이너리 입력은 서버 저장 후 상대 경로를 사용한다.
3. URL 입력은 v1에서 핫링크 참조를 기본 정책으로 한다.
4. 실패는 사용자에게 즉시 가시화하고, 재시도 경로를 제공한다.
5. 워크스페이스 루트 이탈 방지를 보안 최우선 규칙으로 둔다.

---

## 3. 삽입 경로별 실행 설계

## 3.1 로컬 파일 삽입

- 진입: 툴바 `+ 이미지` 또는 컨텍스트 메뉴 `이미지 삽입`
- 입력: `File Picker (accept=image/*)`
- 처리:
  1. 파일 타입/크기 1차 검증(클라이언트)
  2. 스켈레톤 노드 생성(optimistic UI)
  3. `POST /assets/upload` 업로드
  4. 성공 시 `src`를 상대 경로로 확정하고 노드 finalize
  5. 실패 시 에러 배지 + `재시도/제거`
- 배치: 캔버스 중심 또는 호출 좌표

## 3.2 URL 삽입

- 진입: 삽입 모달 `URL` 탭
- 입력: `http/https` URL 문자열
- 처리:
  1. 스킴/길이(<=2048)/금지 스킴 검증
  2. 허용 시 `sourceType=url` 노드 생성
  3. 이미지 로드 실패 시 플레이스홀더 표시
  4. `재시도` 제공 (동일 URL 재요청)
- 배치: 캔버스 중심

## 3.3 클립보드 붙여넣기

- 진입: 캔버스 포커스 상태에서 `Cmd/Ctrl+V`
- 입력: `paste` 이벤트의 이미지 blob
- 처리:
  1. 클립보드 항목에서 이미지 MIME 탐지
  2. 텍스트만 있는 경우 기존 붙여넣기 로직으로 즉시 반환
  3. 이미지 blob 업로드 후 노드 확정
- 배치: 현재 뷰포트 중심

## 3.4 드래그 앤 드롭

- 진입: 파일을 캔버스에 드롭
- 입력: `DataTransfer.files`
- 처리:
  1. 비이미지 즉시 필터링
  2. 최대 10개까지 순차 업로드
  3. 개별 성공/실패 상태 분리 표시
- 배치: 첫 파일은 드롭 좌표, 이후 파일당 `(+24px, +24px)` 오프셋

## 3.5 삽입 모드별 코드 반영

- `mode=node`: 대상 Node 내부에 `<Image ... />` 삽입
- `mode=markdown`: 대상 Markdown 블록에 이미지 링크 삽입
- `mode=canvas`: Canvas 독립 이미지 컴포넌트 삽입
- `mode=shape`: 대상 Shape에 `imageSrc`/`imageFit` 속성 삽입

---

## 4. 검증 및 보안 규칙

## 4.1 클라이언트 검증

- 파일 크기: 기본 10MB 초과 시 차단 (`IMG_413_TOO_LARGE`)
- 파일 타입: MIME + 확장자 화이트리스트 (`png/jpg/jpeg/webp/gif/svg`)
- URL:
  - 허용: `http://`, `https://`
  - 거부: 빈 값, `javascript:`, `data:`, 길이 초과
- 다중 드롭: 10개 초과 시 초과 항목 차단 및 안내

## 4.2 서버 보안 검증

- MIME + 매직바이트 이중 검증
- 파일명 정규화:
  - 허용 문자: 영문/숫자/`-`
  - 원본 파일명은 slug + hash 기반으로 치환
- 경로 정책:
  - 저장 경로는 워크스페이스 내부 `assets/images/`만 허용
  - 상대 경로만 반환
  - path traversal (`../`) 차단
- 부분 파일 정리:
  - 업로드 실패 시 임시/부분 파일 삭제 보장

## 4.3 에러 코드 매핑

- `IMG_400_INVALID_SOURCE`: 잘못된 URL/입력
- `IMG_400_UNSUPPORTED_TYPE`: 미지원 포맷
- `IMG_413_TOO_LARGE`: 용량 초과
- `IMG_422_FETCH_FAILED`: URL fetch 실패
- `IMG_500_UPLOAD_FAILED`: 저장 실패
- `IMG_500_PATCH_FAILED`: 코드 반영 실패

---

## 5. 저장 전략

1. 바이너리 입력(로컬/클립보드/드롭)
- 서버가 `assets/images/`에 저장
- 파일명 규칙: `{slug}-{sha256_8}.{ext}`
- 중복 방지(선택): sha256 기준 기존 파일 재사용

2. URL 입력
- v1 기본: 외부 URL을 `src`로 직접 참조(핫링크)
- v1.1 후보: "로컬로 복제" 옵션 추가

3. 코드 반영
- 이미지 노드 데이터 `src`, `alt`, `width`, `height`를 기준으로 TSX 반영
- 반영 성공 후 `file.changed` 이벤트로 재렌더 동기화

4. 영속성 보장
- 저장 + 코드 패치가 모두 성공해야 완료 상태로 전환
- 코드 패치 실패 시 업로드 자산 정리(롤백) 또는 orphan mark 정책 선택

---

## 6. 렌더링 파이프라인

```text
[Input]
  local | url | clipboard | drop
      ↓
[Normalize]
  ImageSource(sourceType, payload, insertPosition)
      ↓
[Validate]
  client validation + server validation(when upload)
      ↓
[Upload]
  binary only -> POST /assets/upload
      ↓
[Node Payload Build]
  { src, alt, width, height, fit?, caption?, sourceType }
      ↓
[Insert]
  mode-specific patch(node/markdown/canvas/shape)
      ↓
[Patch & Sync]
  TSX patch -> file.changed -> canvas re-render
      ↓
[Finalize]
  selected state + resize handle + toast
```

렌더 정책:
- 업로드/검증 중: 스켈레톤 노드
- 성공: 실제 이미지 렌더
- 실패: 에러 상태 노드(재시도/제거)

---

## 7. 단계별 구현(Phase)

## Phase 1. 렌더 기반 구축

목표:
- `type: image` 노드 렌더 안정화

작업:
- `Image` 컴포넌트 추가 및 export
- 파서에서 `graph-image` -> `image` 매핑
- `ImageNode` + `nodeTypes.image` 등록

산출물:
- 샘플 TSX 기준 이미지 노드 렌더 확인

종료 기준:
- AC-08 일부(렌더 필드 대응) 충족

## Phase 2. 삽입 UX + 4경로 통합

목표:
- UI를 통한 삽입 시도 가능

작업:
- `useImageInsert` 통합 훅
- 삽입 모달(파일/URL), paste 이벤트, drop 처리
- 로딩/오류 UI 및 토스트

산출물:
- 4경로 수동 테스트 가능한 UI

종료 기준:
- AC-01~AC-07, AC-11 충족

## Phase 3. 자산 저장/동기화

목표:
- 삽입 결과 새로고침 후 유지

작업:
- `/assets/upload`, `/assets/file` 구현
- `node.insert`(또는 `image.insert`) RPC 구현
- `shape` 대상 패치 경로 추가 (`shape.updateImage` 또는 `node.update`)
- patch + `file.changed` 동기화

산출물:
- 업로드부터 코드 반영까지 E2E 흐름

종료 기준:
- AC-08~AC-10, AC-12 충족

## Phase 4. 안정화/관측성

목표:
- 성능, 보안, 회귀 위험 관리

작업:
- MIME/시그니처/경로 검증 강화
- 메트릭(성공률, 지연, 실패코드) 계측
- 회귀 테스트 확장

종료 기준:
- 비기능 요구사항 달성 + 치명 결함 0건

---

## 8. 테스트 전략

## 8.1 단위 테스트

- `libs/cli/src/commands/image.ts` 핵심 함수 단위 테스트
  - `parseArgs`
    - `--file` 누락 시 즉시 실패
    - `--source` 누락 시 즉시 실패
    - `--mode` 미지정/지원되지 않음(외부 값) 실패
    - `node|markdown|shape`에서 `--target` 필수 검증
    - `--width`, `--height`, `--x`, `--y` 숫자 파싱 실패
    - `--fit` 허용값 검사(`cover|contain|fill|none|scale-down`)
  - `resolveWorkspaceRoot`
    - `MAGAM_TARGET_DIR` 사용
    - 미설정 시 `process.cwd()` 기반 계산
  - `resolveFileInWorkspace`
    - 상대 경로 파일이 루트 내부로 변환되는지
    - 루트 밖 경로를 들어오면 즉시 실패
  - `toRelativeImportPath`
    - 동일 디렉터리/상위/하위 경로 변환 정확도
    - Windows 경로 구분자(`\\`) 정규화
  - `validateImageSourceName`, `detectImageType`
    - 허용 확장자 통과/거부
    - 파일 시그니처 판별 성공/실패
    - 크기/확장자 위변조 케이스
  - `hashBuffer`, `sanitizeBaseName`
    - 동일 입력 동일 해시
    - 특수문자 제거 및 fallback 이름 처리

- 패치 로직 단위 테스트(입력→출력 코드 스냅샷)
  - `createImageElement`
    - `src`, `alt`, `width`, `height`, `x`, `y`, `fit`, `id` 조합별 렌더 구조
  - `createMarkdownToken`
    - `alt` 이스케이프 처리
  - `replaceMarkdownContent` + `getMarkdownText`
    - `<Markdown>` 단일 텍스트 자식 처리
    - `JSXText`/`JSXExpressionContainer` 텍스트 추출
    - self-closing markdown 태그 변환
  - `patch*` 함수군
    - `patchNodeChildren`: `<Node id="...">` 자식 추가
    - `patchCanvasImage`: self-closing `<Canvas />`, closing `<Canvas></Canvas>` 모두 처리
    - `patchMarkdown`: `<Markdown>` 태그 존재, Node 하위 Markdown fallback, target 미스매치 실패
    - `patchShapeImage`: `Shape` self-closing + opening/closing 양식에서 `imageSrc`, `imageFit` 설정
  - `ensureImageImport`
    - 기존 `@magam/core` import 존재/미존재 케이스
    - `Image` specifier 중복 없이 추가

- API 라우트 단위 테스트(함수 분리 시 적용)
  - `assets/upload` 파이프라인
    - `sourceType=url` 미지원 동작 코드 반환
    - 파일 크기/확장자/MIME/시그니처 실패 케이스
    - 같은 해시 경로 충돌 시 기존 파일 재사용
    - 성공 저장 후 경로/코드 검증
  - `assets/file` 경로 보안
    - `path` 미존재/빈 값 실패
    - `../`, 절대경로, 디코딩 실패
    - 허용 확장자 이외 파일 접근 거부
    - 정상 MIME/헤더 생성

권장 테스트 구현 위치:
- `libs/cli/src/commands/image.spec.ts` (주요 대상)
- `app/app/api/assets/upload/route.spec.ts` (라우트 유틸 분리 후)
- `app/app/api/assets/file/route.spec.ts` (경로 검증 + 응답 매핑)

## 8.2 통합 테스트

- 업로드 API 성공/실패/부분 파일 정리
- path traversal 차단 (`../` 시도)
- RPC 삽입 후 patch 반영 검증

## 8.3 E2E 테스트

- 파일 삽입 성공/용량 초과/미지원 포맷
- URL 삽입 성공/실패 플레이스홀더/재시도
- paste 이미지 vs 텍스트 paste 회귀
- 단일/다중 드롭(최대 10)
- shape 모드 삽입 후 렌더/속성 반영 검증
- 삽입 후 새로고침 영속성

## 8.4 성능 테스트

- <=2MB 파일 삽입 p95 <= 1.5s
- URL 삽입 p95 <= 2.5s (네트워크 제외 지표 분리)

## 8.5 브라우저 호환성 스모크

- Chromium (기준)
- Safari/Firefox paste 폴백 동작 점검

---

## 9. 롤아웃 계획

1. 내부 플래그 도입
- `imageInsertV1` feature flag behind release

2. 단계 배포
- Stage A: 내부 개발 환경 100%
- Stage B: 사내/파일럿 사용자 20%
- Stage C: 전체 사용자 100%

3. 게이트 지표
- 삽입 성공률 >= 98%
- `IMG_500_*` 비율 < 1%
- 크래시 0건

4. 롤백 기준
- 배포 후 24시간 내 실패율 급증(예: +3%p 이상)
- 코드 반영 실패(`IMG_500_PATCH_FAILED`) 임계치 초과

5. 롤백 방법
- feature flag 즉시 off
- 서버 엔드포인트는 유지하되 UI 진입 비활성화

---

## 10. 리스크와 대응

1. 클립보드 API 브라우저 차이
- 대응: `paste` 이벤트 우선 + 폴백 분기

2. URL 핫링크 만료/차단
- 대응: 플레이스홀더 + 재시도 + v1.1 로컬 복제 옵션

3. 대용량 업로드로 UX 저하
- 대응: 용량 제한, 진행 UI, 업로드 큐 직렬화

4. path traversal/임의 파일 접근
- 대응: 서버 절대경로 검증, 루트 이탈 차단, 상대경로만 노출

5. 코드 패치 실패로 상태 불일치
- 대응: 트랜잭션성 처리(실패 시 롤백/정리), 사용자 경고

---

## 11. DoD (Definition of Done)

아래 조건을 모두 만족하면 Image Insert v1 완료로 본다.

1. 기능
- 4개 삽입 경로가 모두 동작한다.
- `node/markdown/canvas/shape` 4개 삽입 모드가 모두 동작한다.
- 이미지 노드/shape 이미지 속성이 저장 및 렌더된다.

2. 품질
- AC-01~AC-11 전부 통과
- 치명/높음 우선순위 버그 0건

3. 보안
- MIME+매직바이트, 경로 이탈 차단, 파일명 정규화 적용

4. 성능
- PRD p95 목표 충족

5. 운영
- 실패 코드/지연 메트릭 확인 가능
- 롤백 절차 검증 완료

6. 문서
- API 스펙/에러 코드/운영 가이드 최신화 완료

---

## 12. 실행 체크리스트

## 12.1 개발 체크리스트

- [ ] `image` 노드 타입 및 렌더 컴포넌트 구현
- [ ] `useImageInsert` 경로 통합 훅 구현
- [ ] 파일/URL/클립보드/드롭 이벤트 핸들러 구현
- [ ] `/assets/upload` 구현 (검증/저장/응답)
- [ ] `/assets/file` 구현 (안전 경로 제공)
- [ ] `node.insert` 또는 `image.insert` RPC 구현
- [ ] shape 이미지 삽입 패치 경로 구현
- [ ] patch + `file.changed` 동기화 구현
- [ ] 실패 상태 노드(재시도/제거) 구현

## 12.2 테스트 체크리스트

- [ ] 단위 테스트 통과
  - `libs/cli/src/commands/image.spec.ts` 작성 완료
  - `upload/file` 경로 검증 모듈 테스트 케이스 추가
- [ ] 통합 테스트 통과
- [ ] E2E 시나리오(AC-01~AC-11) 통과
- [ ] 성능 목표 충족
- [ ] 브라우저 스모크 테스트 통과

## 12.3 배포 체크리스트

- [ ] feature flag 기본 OFF 확인
- [ ] 파일럿 배포 및 지표 모니터링
- [ ] 전체 배포 전 rollback rehearsal 완료
- [ ] 운영 대시보드/알람 룰 적용

---

## 13. 오픈 결정 항목 (PRD 연계)

1. URL 기본 정책 유지: 핫링크(v1) / 자동 로컬 복제(v1.1)
2. 저장 경로 고정: `assets/images/` 확정 여부
3. 실패 처리 정책: 롤백 기본 + 에러 노드 보조 노출 여부
4. RPC 방식: `node.insert` 범용 vs `image.insert` 전용

현재 계획은 PRD 기준으로 v1 범위와 수용기준을 우선 충족하도록 설계되었다.
