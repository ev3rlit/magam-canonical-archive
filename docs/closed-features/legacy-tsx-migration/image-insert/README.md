# 이미지 삽입 PRD (Code-First)

## 1. 배경

현재 Magam는 양방향 편집(UI에서 직접 캔버스 조작 후 코드 반영) 기능이 없습니다.  
따라서 사용자는 캔버스 UI에서 이미지를 추가/수정할 수 없고, 결과적으로 **React 코드 작성 경로**가 유일한 생산 경로입니다.

이미지 기능도 동일하게 코드 우선으로 설계해야 하며, 사용자가 이미지 파일을 로드한 뒤 컴포넌트 형태로 TSX에 안전하게 삽입할 수 있어야 합니다.

---

## 2. 문제 정의

사용자 관점:

1. 이미지 삽입을 하고 싶어도 어떤 컴포넌트를 어떤 형태로 써야 하는지 일관된 방법이 없다.
2. 삽입 목적(노드 내부, 마크다운 링크, 캔버스 독립 이미지, Shape 내부 이미지)에 따라 코드 패턴이 달라 실수가 잦다.
3. 이미지 자산 경로를 수동 관리하다 경로 오류/누락이 자주 발생한다.

제품 관점:

1. UI 기반 삽입 흐름(모달, 드롭, 붙여넣기)을 전제로 한 설계는 현재 제품 단계와 맞지 않는다.
2. 코드 생성/패치 중심의 삽입 규칙과 컴포넌트 표준이 문서화되어 있지 않다.
3. 파일 로드 -> 자산 저장 -> 코드 삽입까지의 단일 파이프라인이 필요하다.

---

## 3. 목표와 비목표

### 목표 (Goals)

1. 사용자가 이미지 파일을 로드해 프로젝트 자산으로 저장할 수 있다.
2. 저장된 이미지를 아래 4가지 방식으로 React 코드에 삽입할 수 있다.
- Node 컴포넌트 내부 삽입
- Markdown 컴포넌트 내부 링크 삽입
- Canvas 위 독립 Image 컴포넌트 삽입
- Shape 컴포넌트 내부(또는 fill) 이미지 삽입
3. 코드 생성/패치 결과가 즉시 렌더에 반영되고 재실행/재렌더 후에도 유지된다.
4. 삽입 경로를 명령형 도구(예: CLI/MCP Tool)로 표준화한다.

### 비목표 (Non-Goals)

1. 캔버스 UI에서 직접 드래그 앤 드롭/붙여넣기/컨텍스트 메뉴 삽입
2. 이미지 편집(크롭, 필터, 주석)
3. 멀티유저 충돌 해결(CRDT/OT)
4. 영상/애니메이션 포맷 지원

---

## 4. 사용자 시나리오

### 시나리오 A: Node 컴포넌트 내부 삽입

1. 사용자가 로컬 이미지를 로드한다.
2. 도구가 `assets/images/...`에 파일을 저장한다.
3. 대상 `<Node id="...">` 내부에 `<Image src="..." alt="..." />` 코드가 삽입된다.

### 시나리오 B: Markdown 컴포넌트 링크 삽입

1. 사용자가 로컬 이미지 또는 URL을 입력한다.
2. 도구가 마크다운 문자열에 `![alt](path-or-url)`를 삽입한다.
3. `<Markdown>` 렌더에서 이미지가 표시된다.

### 시나리오 C: Canvas 독립 이미지 삽입

1. 사용자가 삽입 대상 파일과 좌표(`x`, `y`)를 지정한다.
2. 도구가 `<Image id="..." src="..." x={...} y={...} />` 또는 프로젝트 표준 래퍼 코드를 생성한다.
3. 캔버스에서 독립 요소로 렌더된다.

### 시나리오 D: Shape 내부 이미지 삽입

1. 사용자가 대상 Shape id와 이미지 소스를 지정한다.
2. 도구가 Shape 컴포넌트에 이미지 속성(`imageSrc` 등 표준 props)을 삽입한다.
3. 도형 내부 또는 도형 배경 이미지로 렌더된다.

---

## 5. 기능 요구사항

### 5.1 입력/로드 요구사항

1. 로컬 파일 로드 지원 (`png`, `jpg`, `jpeg`, `webp`, `gif`, `svg`)
2. URL 입력 지원 (`http`, `https`)
3. 파일 크기 제한 기본 10MB
4. MIME + 확장자 + 매직바이트 검증

### 5.2 삽입 모드 요구사항

1. `mode=node`: 지정된 Node 내부에 Image 컴포넌트 삽입
2. `mode=markdown`: 지정된 Markdown 문자열/블록에 이미지 링크 삽입
3. `mode=canvas`: 캔버스 독립 이미지 컴포넌트 삽입
4. `mode=shape`: 지정된 Shape에 이미지 속성 삽입

### 5.3 코드 생성 요구사항

1. 삽입 시 import가 없으면 자동 추가
2. 중복 import는 생성하지 않음
3. 포맷/들여쓰기 규칙을 기존 파일 스타일에 맞춤
4. 실패 시 원본 파일 무변경 보장

### 5.4 자산 관리 요구사항

1. 로컬 파일은 워크스페이스 내부 고정 경로(`assets/images/`) 저장
2. 파일명 충돌 시 해시 또는 suffix로 충돌 회피
3. URL 모드는 기본 핫링크, 옵션으로 로컬 복제 허용

### 5.5 수용 기준 (Acceptance Criteria)

| ID | 기준 |
|---|---|
| AC-01 | 로컬 이미지 로드 시 자산이 `assets/images/`에 저장된다. |
| AC-02 | `mode=node` 실행 시 대상 Node 내부에 Image 컴포넌트 코드가 삽입된다. |
| AC-03 | `mode=markdown` 실행 시 Markdown 본문에 `![alt](...)` 링크가 삽입된다. |
| AC-04 | `mode=canvas` 실행 시 캔버스 독립 이미지 컴포넌트가 생성된다. |
| AC-05 | `mode=shape` 실행 시 대상 Shape에 이미지 속성이 삽입된다. |
| AC-06 | 삽입 후 렌더 결과에서 이미지가 정상 표시된다. |
| AC-07 | 삽입 실패 시 파일이 부분 변경되지 않는다(atomic patch). |
| AC-08 | 비이미지 파일 입력 시 명확한 오류 코드와 메시지를 반환한다. |
| AC-09 | 경로 조작(`../`) 입력은 차단된다. |
| AC-10 | 동일 입력 재실행 시 import 중복이 생기지 않는다. |
| AC-11 | Node/Markdown/Canvas/Shape 4모드 모두 회귀 테스트를 통과한다. |

---

## 6. 비기능 요구사항

1. 안정성
- 패치 실패 시 원본 복구 100%

2. 성능
- 단일 로컬 파일 로드+코드 삽입 p95 2초 이하(개발 환경 기준)

3. 보안
- 워크스페이스 루트 밖 경로 접근 금지
- 미지원 MIME 즉시 차단

4. 관측성
- 모드별 성공/실패율 및 처리 시간 로깅

---

## 7. UX 제안 (현재 제품 제약 반영)

현재는 UI 삽입 기능 대신 **코드 생성 워크플로**를 공식 UX로 정의한다.

1. 진입점
- CLI 명령
- MCP Tool 호출
- 에디터 명령 팔레트(코드 패치 호출)

2. 사용자 입력
- `source`(로컬 경로 또는 URL)
- `mode`(`node` | `markdown` | `canvas` | `shape`)
- `target`(파일 경로 + 대상 컴포넌트 id 또는 마크다운 블록)
- 옵션(`alt`, `width`, `height`, `x`, `y`)

3. 결과 피드백
- 생성된 자산 경로
- 삽입된 코드 위치
- 실패 시 원인/복구 가이드

---

## 8. 기술 설계 개요

### 8.1 파이프라인

```text
input(source, mode, target)
 -> validate source
 -> (local/url-copy) asset save
 -> build insertion snippet by mode
 -> AST patch TSX/Markdown string
 -> write file atomically
 -> render pipeline reflects change
```

### 8.2 제안 컴포넌트/문법

1. Node 내부 삽입

```tsx
<Node id="logo-node">
  <Image src="./assets/images/logo.png" alt="logo" width={240} />
</Node>
```

2. Markdown 링크 삽입

```tsx
<Markdown>{`
![architecture](./assets/images/architecture.png)
`}</Markdown>
```

3. Canvas 독립 이미지 삽입 (프로젝트 표준 예시)

```tsx
<Image id="hero-image" src="./assets/images/hero.png" alt="hero" x={320} y={180} width={360} />
```

4. Shape 내부 이미지 삽입 (프로젝트 표준 제안)

```tsx
<Shape id="decision-1" kind="diamond" imageSrc="./assets/images/icon.png" imageFit="contain" />
```

### 8.3 인터페이스 제안 (예시)

```bash
magam image insert \
  --file examples/TODO.tsx \
  --source ./tmp/logo.png \
  --mode shape \
  --target shape:decision-1 \
  --alt "logo"
```

---

## 9. 단계별 구현 계획

### Phase 1: 컴포넌트/렌더 표준화

1. `Image` 컴포넌트의 props 표준 확정 (`src`, `alt`, `width`, `height`, `x`, `y`)
2. Node/Canvas 렌더 경로에서 Image 정상 표시 보장

### Phase 2: 자산 로드/저장 파이프라인

1. 로컬 파일 저장 및 URL 검증/복제 옵션 구현
2. 경로 정책/파일명 정책/검증 로직 적용

### Phase 3: 모드별 코드 패치

1. `node` 모드 패치
2. `markdown` 모드 패치
3. `canvas` 모드 패치
4. `shape` 모드 패치

### Phase 4: 툴링 통합

1. CLI 명령 연결
2. MCP Tool 연결
3. 에러 코드/로그/사용자 메시지 정리

### Phase 5: 안정화

1. 회귀 테스트
2. 성능 측정 및 병목 제거
3. 문서/예제 갱신

---

## 10. 성공 지표

1. 4개 삽입 모드 성공률 >= 98%
2. 이미지 삽입 관련 코드 패치 실패율 <= 2%
3. 삽입 후 렌더 불일치 이슈 0건(주요 시나리오 기준)

---

## 11. 리스크 및 대응

| 리스크 | 영향 | 대응 |
|---|---|---|
| 대상 노드/마크다운 블록 탐색 실패 | 코드 삽입 불가 | 타겟 지정 규칙 강화 + 사전 검증 |
| import 충돌/중복 | 빌드 오류 가능 | AST 기반 중복 제거 로직 |
| URL 자산 불안정 | 렌더 깨짐 | 핫링크 기본 + 로컬 복제 옵션 제공 |
| 경로 오염 | 보안/무결성 문제 | 루트 이탈 차단, 정규화 강제 |

---

## 12. 오픈 질문

1. Canvas 독립 이미지의 표준 컴포넌트 시그니처를 `Image` 단일로 고정할지?
2. Markdown 모드에서 링크만 넣을지, 크기 제어 문법까지 확장할지?
3. URL 입력 기본 정책을 핫링크로 유지할지, 기본 로컬 복제로 전환할지?
4. 첫 릴리스에서 CLI만 제공할지, MCP Tool을 동시에 제공할지?
