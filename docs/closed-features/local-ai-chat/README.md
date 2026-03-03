# Local AI Chat 기능 PRD (Magam)

## 0. How to verify locally (release-check quick list)

> 현재 코드베이스 기준으로 바로 확인 가능한 최소 절차입니다.

1. 의존성 설치

   ```bash
   bun install
   ```

2. 개발 서버 실행 (CLI HTTP + 앱 개발 서버 포함)

   ```bash
   bun run dev
   ```

   - 기본 chat endpoint: `http://localhost:3002/chat/*`
   - 포트 변경: `MAGAM_HTTP_PORT=<port> bun run dev`

3. 채팅 스모크 테스트 실행

   ```bash
   bun run chat:smoke
   ```

   - 필요 시 provider 지정:

     ```bash
     MAGAM_SMOKE_PROVIDER=codex bun run chat:smoke
     ```

4. 수동 UI 확인 (선택)
   - Chat 패널 열기 → provider 선택
   - 짧은 프롬프트 전송 (예: "한 줄로 답해줘")
   - 스트리밍 응답 및 중단 버튼 동작 확인

## 0.1 TODO / Known limitations (현재 단계)

- 채팅 세션/히스토리는 메모리 기반이며 재시작 시 유지되지 않는다.
- 세션 영속화/다중 세션 관리는 `docs/features/chat-session-management/README.md` 및 `implementation-plan.md`를 기준으로 vNext에서 도입한다.
- provider adapter는 현재 CLI 직접 실행 래퍼 방식이며, PRD의 SDK 우선 설계와 완전 일치하지 않는다(후속 정렬 필요).
- smoke 테스트는 endpoint/스트림 계약 검증 중심이며, 실제 provider 인증/로그인 상태까지 보장하지 않는다.
- 스트림 중단(`POST /chat/stop`)은 실패가 아니라 정상 종료로 취급한다. 서버는 중단 시 `event: done`(metadata에 `stopped: true`, `code: "ABORTED"`)를 보낼 수 있으며 smoke는 이를 PASS로 간주한다.
- 동시 다중 채팅 실행보다 단일 세션 실행 안정성에 우선순위를 둔 구현이다.

## 1. 배경

Magam는 사용자가 TSX 코드로 다이어그램을 작성하면 캔버스에 렌더링하는 "AI-Native Programmatic Whiteboard"이다. 현재 사용자가 다이어그램을 수정하려면 직접 TSX 코드를 편집해야 하며, AI 보조를 받으려면 외부 도구(터미널, 브라우저 등)를 오가야 한다.

시장의 AI 코딩 도구들(Cursor, Windsurf 등)은 자체 API 키 기반으로 동작하여 사용자에게 추가 비용을 부과하거나, 특정 모델/프롬프트 포맷에 종속된다. 반면, **Claude Code**, **Gemini CLI**, **Codex CLI** 같은 로컬 AI CLI 도구들은 사용자의 기존 구독(Claude Pro, Gemini Advanced, ChatGPT Plus 등)을 그대로 활용하며, **파일 시스템을 직접 읽고 쓰는 에이전트** 방식으로 동작한다.

이 기획은 Magam 내에 채팅 인터페이스를 도입하되, 백엔드 API 서버를 두지 않고 **사용자의 로컬 머신에 설치된 AI CLI를 공식 SDK를 통해 호출**하는 방식을 제안한다. Claude Code와 Codex CLI는 각각 공식 TypeScript SDK(`@anthropic-ai/claude-agent-sdk`, `@openai/codex-sdk`)를 제공하며, 이 SDK들은 내부적으로 CLI를 subprocess로 spawn하고 JSONL로 통신하는 구조이다. 이를 통해:

1. **사용자 구독 활용**: 추가 API 비용 없이 사용자의 기존 AI 구독을 그대로 사용
2. **파일 I/O 기반 처리**: 텍스트 출력 포맷을 강제하지 않고, AI가 직접 파일을 읽고 수정
3. **실시간 반영**: 기존 파일 감시(chokidar) + WebSocket 파이프라인을 통해 AI의 파일 변경이 즉시 캔버스에 반영
4. **모델 자유 선택**: 사용자가 원하는 AI 도구를 자유롭게 선택 가능
5. **공식 SDK 활용**: 출력 파싱, 세션 관리, 프로세스 라이프사이클을 SDK가 캡슐화하여 유지보수 부담 최소화

---

## 2. 문제 정의

### 사용자 관점 문제

1. 다이어그램 수정을 위해 "의도 → 코드 변환"을 사용자가 직접 수행해야 한다.
2. 외부 AI 도구에 컨텍스트를 복사/붙여넣기하는 과정이 번거롭다.
3. AI가 생성한 코드를 다시 파일에 수동으로 적용해야 한다.
4. API 기반 AI 통합은 추가 비용과 API 키 관리 부담을 수반한다.

### 제품 관점 문제

1. AI 통합 없이는 "AI-Native" 비전의 핵심 가치를 전달하기 어렵다.
2. API 서버 운영 없이 AI 기능을 제공할 수 있는 차별화된 아키텍처가 필요하다.
3. 다양한 AI 모델/도구를 지원하되 특정 벤더에 종속되지 않아야 한다.

---

## 3. 핵심 컨셉: "Bring Your Own AI"

### 동작 원리

```
사용자 채팅 입력
  → Magam이 선택된 AI CLI를 자식 프로세스로 실행
  → AI CLI가 프로젝트 파일을 직접 읽고/수정
  → 기존 chokidar 파일 감시가 변경 감지
  → WebSocket으로 변경 브로드캐스트
  → 캔버스 자동 재렌더링
```

### 기존 API 기반 AI 통합과의 차이점

| 항목 | API 기반 (일반적) | Local AI CLI (본 기획) |
|------|-------------------|----------------------|
| 비용 | 서비스 제공자가 API 비용 부담 또는 사용자에게 전가 | 사용자의 기존 구독 활용 (추가 비용 없음) |
| AI 처리 방식 | 프롬프트 → 텍스트 응답 → 파싱 → 파일 적용 | AI가 파일 시스템에 직접 접근하여 읽기/쓰기 |
| 출력 포맷 의존성 | 특정 JSON/마크다운 포맷 강제 필요 | 포맷 제약 없음 — 파일 변경이 곧 결과 |
| 컨텍스트 이해 | 제한된 컨텍스트 윈도우 내 텍스트 | 전체 프로젝트 파일 시스템 접근 가능 |
| 모델 선택 | 서비스가 지정한 모델 | 사용자가 자유 선택 (Claude/Gemini/GPT 등) |
| 서버 인프라 | API 프록시 서버 필요 | 서버 불필요 — 로컬 프로세스만 사용 |
| 오프라인 지원 | 불가 | CLI 도구에 따라 부분 가능 |

---

## 4. 선행 사례 (Prior Art)

이 "로컬 AI CLI를 프록시하는" 접근법은 이미 활발한 오픈소스 생태계가 검증하고 있다.

### 4.1 CLIProxyAPI

[CLIProxyAPI](https://github.com/router-for-me/CLIProxyAPI)는 Go로 작성된 프로젝트로, Claude Code / Gemini CLI / Codex CLI 등을 자식 프로세스로 spawn하고 OpenAI 호환 API로 노출한다. 모델 이름 prefix로 라우팅하며 (`claude-*` → Claude Code, `gemini-*` → Gemini CLI), 사용자의 기존 OAuth 구독을 그대로 활용한다. 멀티 계정 로드밸런싱을 지원하며, macOS 앱(VibeProxy), VSCode 확장, Windows 데스크톱 앱 등 풍부한 파생 생태계가 형성되어 있다.

### 4.2 공식 SDK

| CLI | 공식 SDK | 내부 동작 |
|-----|---------|----------|
| **Claude Code** | `@anthropic-ai/claude-agent-sdk` (TypeScript/Python) | CLI를 subprocess로 spawn, stdin/stdout으로 **JSONL 양방향 통신** |
| **Codex CLI** | `@openai/codex-sdk` (TypeScript) | CLI를 subprocess로 spawn, stdin/stdout으로 **JSONL 스트리밍** |
| **Gemini CLI** | 공식 SDK 없음 (요청 중) | 직접 `child_process.spawn` 필요 |

Claude Agent SDK와 Codex SDK는 모두 **우리가 설계하려는 것과 동일한 패턴(subprocess spawn + JSONL 파싱)을 이미 캡슐화**하고 있다.

### 4.3 Magam의 차별점

CLIProxyAPI 등 기존 프로젝트는 **범용 API 프록시**이다. Magam의 Local AI Chat은:

- **도메인 특화**: 시스템 프롬프트에 `@magam/core` 컴포넌트 API를 자동 주입하여 정확한 다이어그램 TSX 생성 유도
- **캔버스 실시간 연동**: 파일 변경 → chokidar → WebSocket → 캔버스 자동 업데이트라는 기존 파이프라인과 자연스럽게 통합
- **시각적 피드백 루프**: AI가 파일을 수정하면 다이어그램이 눈앞에서 변하는 경험을 제공

---

## 5. 목표와 비목표

### 목표 (Goals)

1. Magam 내 채팅 UI에서 자연어로 다이어그램 생성/수정을 요청한다.
2. 로컬에 설치된 AI CLI(Claude Code, Gemini CLI, Codex CLI)를 자동 감지하고 실행한다.
3. AI CLI의 stdout/stderr를 실시간 스트리밍하여 채팅 UI에 표시한다.
4. AI가 수정한 파일 변경사항이 기존 파이프라인을 통해 캔버스에 자동 반영된다.
5. 채팅 세션 히스토리를 유지하여 대화 맥락을 보존한다.
6. 사용자가 AI 도구를 자유롭게 전환할 수 있다.

### 비목표 (Non-Goals)

1. Magam 자체 API 키 기반 AI 호출 (자체 LLM 서비스 운영)
2. AI CLI 설치/구독 관리 대행
3. AI CLI의 내부 동작 커스터마이징 (프롬프트 엔지니어링 수준만 제공)
4. 실시간 협업 환경에서의 동시 AI 세션 동기화
5. 모바일/태블릿 지원 (데스크톱 CLI 도구 의존)

---

## 6. 지원 AI CLI 도구

### 6.1 1차 지원 대상

| CLI 도구 | 실행 명령어 | 공식 SDK | 비대화형 모드 | 필요 구독 |
|----------|------------|---------|-------------|----------|
| **Claude Code** | `claude` | `@anthropic-ai/claude-agent-sdk` | `claude -p --output-format stream-json` | Claude Pro/Max/Team |
| **Gemini CLI** | `gemini` | 없음 (직접 spawn) | `gemini "prompt"` (positional arg) | Gemini Advanced 또는 API 키 |
| **Codex CLI** | `codex` | `@openai/codex-sdk` | `codex exec --json "prompt"` | ChatGPT Plus/Pro 또는 API 키 |

### 6.2 통합 전략 (SDK 우선)

```
CLIAdapter (공통 인터페이스)
  ├── ClaudeAdapter  → @anthropic-ai/claude-agent-sdk (SDK가 subprocess + JSONL 관리)
  ├── CodexAdapter   → @openai/codex-sdk             (SDK가 subprocess + JSONL 관리)
  └── GeminiAdapter  → child_process.spawn()          (SDK 미제공, 직접 관리)
```

Claude Code와 Codex CLI는 **공식 SDK를 통해 호출**한다. SDK가 subprocess spawn, JSONL 파싱, 세션 관리, 에러 핸들링을 캡슐화하므로 직접 구현할 필요가 없다. Gemini CLI만 공식 SDK가 없어 `child_process.spawn`으로 직접 관리한다.

### 6.3 CLI 감지 전략

1. SDK 패키지 import 가능 여부 확인 (Claude, Codex)
2. `which` / `where` 명령으로 CLI 실행 파일 존재 여부 확인 (Gemini, 폴백)
3. `--version` 실행으로 설치 상태 검증
4. 감지 결과를 캐시하여 반복 확인 방지
5. 미설치 도구는 UI에서 비활성 표시 + 설치 안내 링크 제공

### 6.4 확장 가능성

플러그인/어댑터 패턴으로 설계하여 향후 추가 CLI 도구 지원이 용이하도록 한다:
- Aider
- Continue CLI
- Cline CLI
- 기타 MCP 호환 도구

---

## 7. 사용자 시나리오

### 시나리오 A: 새 다이어그램 생성

1. 사용자가 빈 파일(`architecture.tsx`)을 열고 채팅 패널을 연다.
2. AI 도구로 "Claude Code"를 선택한다.
3. 채팅에 "마이크로서비스 아키텍처 다이어그램을 그려줘. API Gateway, Auth Service, User Service, Order Service를 포함해줘"라고 입력한다.
4. Magam이 Claude Agent SDK의 `query()` API에 프로젝트 컨텍스트와 함께 프롬프트를 전달한다.
5. Claude Code가 `architecture.tsx` 파일을 직접 수정한다.
6. 파일 변경이 감지되어 캔버스에 마이크로서비스 다이어그램이 자동으로 나타난다.
7. 채팅에 AI의 응답(작업 내용 설명)이 스트리밍된다.

### 시나리오 B: 기존 다이어그램 수정

1. 사용자가 기존 마인드맵을 보며 채팅에 "marketing 노드 아래에 'Social Media', 'Email Campaign', 'SEO' 하위 노드를 추가해줘"라고 입력한다.
2. AI가 현재 파일을 읽고 해당 위치에 노드를 추가한다.
3. 캔버스가 실시간으로 업데이트되어 새 노드가 나타난다.

### 시나리오 C: AI 도구 전환

1. 사용자가 Claude Code로 작업하다가 Gemini CLI로 전환하고 싶다.
2. 채팅 상단의 AI 선택 드롭다운에서 "Gemini CLI"를 선택한다.
3. 이전 대화 히스토리는 유지되지만, 이후 요청은 Gemini CLI로 전달된다.
4. (선택적) 새 세션 시작을 권장하는 안내 표시.

### 시나리오 D: AI 미설치 상태

1. 사용자가 채팅 패널을 연다.
2. 시스템이 로컬 CLI 도구를 탐색하지만 하나도 발견하지 못한다.
3. "설치된 AI CLI 도구가 없습니다"라는 안내와 함께 각 도구의 설치 가이드 링크를 표시한다.
4. 사용자가 도구를 설치한 후 "다시 확인" 버튼으로 재탐색한다.

### 시나리오 E: 시스템 프롬프트를 활용한 Magam 컨텍스트 전달

1. 사용자가 채팅에 메시지를 입력한다.
2. Magam이 자동으로 시스템 프롬프트를 구성한다:
   - 현재 열린 파일 경로 및 내용
   - Magam 컴포넌트 사용법 (`@magam/core` API 요약)
   - 프로젝트 디렉토리 구조
3. AI가 Magam의 컴포넌트 시스템을 이해한 상태에서 정확한 TSX 코드를 생성한다.

---

## 8. 기능 요구사항

| ID | 요구사항 | 수용 기준 (Acceptance Criteria) |
|---|---|---|
| FR-1 | 채팅 패널 UI | 사이드바 또는 하단 패널에서 채팅 인터페이스가 열리고, 메시지 입력/표시가 동작한다. |
| FR-2 | AI CLI 자동 감지 | 앱 시작 시 `claude`, `gemini`, `codex` 설치 여부를 확인하고 UI에 표시한다. |
| FR-3 | AI 도구 선택 | 감지된 CLI 중 하나를 선택할 수 있으며, 기본값은 첫 번째 감지된 도구이다. |
| FR-4 | 메시지 전송 및 CLI 실행 | 사용자 메시지 전송 시 선택된 CLI가 공식 SDK(또는 직접 spawn)를 통해 실행되고 프롬프트가 전달된다. |
| FR-5 | 실시간 응답 스트리밍 | AI CLI의 stdout을 실시간으로 읽어 채팅 UI에 점진적으로 표시한다. |
| FR-6 | 파일 변경 자동 반영 | AI가 수정한 파일이 기존 파일 감시 파이프라인을 통해 캔버스에 자동 반영된다. |
| FR-7 | 시스템 프롬프트 자동 구성 | 현재 파일, Magam 컴포넌트 API, 프로젝트 구조를 시스템 프롬프트에 자동 포함한다. |
| FR-8 | 채팅 히스토리 | 현재 세션의 대화 내역을 유지하고 스크롤하여 확인할 수 있다. |
| FR-9 | 진행 상태 표시 | AI 처리 중 로딩 상태를 표시하고, 완료/에러 상태를 명확히 구분한다. |
| FR-10 | 실행 중단 | AI 처리 중 "중단" 버튼으로 CLI 프로세스를 즉시 종료할 수 있다. |
| FR-11 | 에러 처리 | CLI 실행 실패, 타임아웃, 비정상 종료 시 사용자에게 명확한 에러 메시지를 표시한다. |
| FR-12 | 미설치 안내 | 감지된 CLI가 없을 때 설치 가이드와 재탐색 버튼을 제공한다. |

---

## 9. 비기능 요구사항

| ID | 항목 | 기준 |
|---|---|---|
| NFR-1 | 응답 시작 지연 | CLI 프로세스 시작부터 첫 stdout 수신까지 p95 2초 이하 |
| NFR-2 | 스트리밍 체감 | stdout 청크 수신 후 UI 반영까지 100ms 이하 |
| NFR-3 | 캔버스 안정성 | AI 파일 수정 중 캔버스 크래시/전체 재마운트 0회 |
| NFR-4 | 프로세스 안전성 | CLI 프로세스 비정상 종료 시 좀비 프로세스 0개 |
| NFR-5 | 메모리 안정성 | 채팅 히스토리 100개 메시지에서 메모리 증가량 50MB 이하 |
| NFR-6 | 접근성 | 채팅 입력/메시지 리스트에 적절한 ARIA 속성 제공 |
| NFR-7 | 보안 | CLI 실행 시 사용자 확인 없이 임의 명령이 실행되지 않아야 한다 |

---

## 10. UX 제안

### 9.1 채팅 패널 레이아웃

```
┌─────────────────────────────────────────────────────────┐
│  Header  [파일명]                    [AI: Claude Code ▼] │
├─────────────────────────────────┬───────────────────────┤
│                                 │  ┌─ Chat Panel ─────┐ │
│                                 │  │                   │ │
│         Canvas                  │  │  User: 마인드맵에  │ │
│       (ReactFlow)               │  │  새 노드 추가해줘  │ │
│                                 │  │                   │ │
│                                 │  │  AI: 네, marketing│ │
│                                 │  │  노드 아래에 3개   │ │
│                                 │  │  하위 노드를       │ │
│                                 │  │  추가하겠습니다... │ │
│                                 │  │                   │ │
│                                 │  │  ✓ 파일 수정 완료  │ │
│                                 │  │                   │ │
│                                 │  ├───────────────────┤ │
│                                 │  │ [메시지 입력...]   │ │
│                                 │  │           [전송▶] │ │
│                                 │  └───────────────────┘ │
├─────────────────────────────────┴───────────────────────┤
│  Footer / Status Bar                                     │
└─────────────────────────────────────────────────────────┘
```

### 9.2 채팅 패널 상태

| 상태 | 표현 |
|------|------|
| 초기 (AI 감지 전) | 스캔 중 스피너 |
| AI 미설치 | 설치 안내 카드 + 설치 링크 + "다시 확인" 버튼 |
| 준비 완료 | 입력 활성화 + 선택된 AI 표시 |
| AI 처리 중 | 스트리밍 텍스트 + 로딩 인디케이터 + "중단" 버튼 |
| 완료 | AI 응답 + 파일 변경 요약 배지 |
| 에러 | 에러 메시지 + 재시도 버튼 |

### 9.3 AI 도구 선택 UI

- 헤더 우측에 드롭다운: `[🤖 Claude Code ▼]`
- 감지된 도구만 선택 가능 (미설치는 회색 + 설치 링크)
- 선택 변경 시 새 세션 시작 권장 안내

### 9.4 메시지 표현

- **사용자 메시지**: 우측 정렬, 배경색 구분
- **AI 응답**: 좌측 정렬, 마크다운 렌더링 지원
- **시스템 메시지**: 중앙 정렬, 작은 폰트 (파일 변경 알림, AI 전환 등)
- **파일 변경 배지**: AI 응답 하단에 `📄 architecture.tsx 수정됨` 형태로 표시

### 9.5 단축키

| 동작 | 단축키 |
|------|--------|
| 채팅 패널 열기/닫기 | `Cmd/Ctrl + L` |
| 메시지 전송 | `Enter` (Shift+Enter로 줄바꿈) |
| AI 처리 중단 | `Cmd/Ctrl + .` 또는 `Esc` |
| 입력창 포커스 | `Cmd/Ctrl + L` (패널 열린 상태) |

---

## 11. 기술 설계 개요

### 11.1 아키텍처 (SDK 기반)

```
┌─ Next.js Frontend (Port 3000) ─────────────────────────┐
│                                                          │
│  ChatPanel Component                                     │
│    ├─ AI Selector (드롭다운)                              │
│    ├─ Message List (스크롤)                               │
│    ├─ Input Area (입력 + 전송)                            │
│    └─ Status Indicator                                   │
│                                                          │
│  Zustand Store (chat slice)                              │
│    ├─ messages[]                                         │
│    ├─ activeProvider                                     │
│    ├─ availableProviders[]                               │
│    ├─ status: idle | thinking | streaming | error        │
│    └─ currentSessionId                                   │
│                                                          │
└──────────────────────┬───────────────────────────────────┘
                       │ API Route / WebSocket
                       ▼
┌─ CLI Server Layer (Port 3002) ─────────────────────────┐
│                                                          │
│  ChatHandler                                             │
│    ├─ CLIDetector (설치 감지)                              │
│    ├─ CLIAdapter (공통 인터페이스)                          │
│    │    ├─ ClaudeAdapter  → claude-agent-sdk (JSONL)     │
│    │    ├─ CodexAdapter   → codex-sdk (JSONL)            │
│    │    └─ GeminiAdapter  → child_process.spawn (raw)    │
│    ├─ PromptBuilder (시스템 프롬프트 구성)                   │
│    └─ SessionManager (세션/히스토리)                        │
│                                                          │
└──────────────────────┬───────────────────────────────────┘
                       │ SDK가 내부적으로 subprocess 관리
                       ▼
┌─ Local AI CLI (SDK가 관리하는 subprocess) ────────────────┐
│  claude / gemini / codex                                 │
│    ├─ 프로젝트 파일 읽기                                   │
│    ├─ 파일 수정/생성                                      │
│    └─ JSONL 또는 stdout으로 진행 상황 출력                  │
└──────────────────────┬───────────────────────────────────┘
                       │ 파일 시스템 변경
                       ▼
┌─ 기존 Magam 파이프라인 ────────────────────────────────────┐
│  chokidar 파일 감시 → WebSocket 브로드캐스트                 │
│    → HTTP /render 재호출 → 캔버스 자동 업데이트              │
└─────────────────────────────────────────────────────────┘
```

### 11.2 CLI 어댑터 인터페이스 (SDK 우선 설계)

```ts
// 공통 어댑터 인터페이스
interface CLIAdapter {
  id: ProviderId;                  // 'claude' | 'gemini' | 'codex'
  displayName: string;             // 'Claude Code' | 'Gemini CLI' | 'Codex CLI'
  installUrl: string;

  // 감지
  detect(): Promise<ProviderInfo>;

  // 실행 — SDK 또는 직접 spawn 내부 구현에 따라 다름
  run(prompt: string, options: CLIRunOptions): AsyncIterable<ChatChunk>;

  // 중단
  abort(): void;
}

interface CLIRunOptions {
  systemPrompt?: string;
  workingDirectory: string;
  currentFile?: string;
  timeout?: number;               // 기본 300초
}

interface ChatChunk {
  type: 'text' | 'tool_use' | 'file_change' | 'error' | 'done';
  content: string;
  metadata?: Record<string, unknown>;
}
```

### 11.3 CLI별 통합 전략

| CLI | 통합 방식 | 패키지 | 스트리밍 | 세션 관리 |
|-----|----------|--------|---------|----------|
| **Claude Code** | **Claude Agent SDK** | `@anthropic-ai/claude-agent-sdk` | `query()` → async iterator (JSONL) | SDK 내장 (session fork/resume) |
| **Codex CLI** | **Codex SDK** | `@openai/codex-sdk` | `runStreamed()` → async generator (JSONL events) | SDK 내장 (`Thread` + `resumeThread()`) |
| **Gemini CLI** | **직접 spawn** | `child_process` | stdout stream → NDJSON 또는 raw text 파싱 | 자체 구현 (세션 ID + `--resume` flag) |

**Claude Agent SDK 사용 예시:**
```ts
import { query } from '@anthropic-ai/claude-agent-sdk';

const messages = query({
  prompt: userMessage,
  options: {
    systemPrompt: magamContext,
    cwd: workingDirectory,
    allowedTools: ['Read', 'Write', 'Edit'],
  }
});

for await (const message of messages) {
  // JSONL 메시지 → ChatChunk로 변환하여 SSE 전송
}
```

**Codex SDK 사용 예시:**
```ts
import { Codex } from '@openai/codex-sdk';

const codex = new Codex();
const thread = codex.startThread();
const stream = thread.runStreamed(userMessage);

for await (const event of stream) {
  // JSONL 이벤트 → ChatChunk로 변환하여 SSE 전송
}
```

> Gemini CLI만 SDK가 없으므로 `child_process.spawn`으로 직접 관리한다. Gemini CLI의 공식 SDK가 출시되면 어댑터를 SDK 기반으로 교체한다.

### 11.4 시스템 프롬프트 자동 구성

AI CLI 호출 시 다음 컨텍스트를 자동으로 포함한다:

```
1. 역할 정의
   "You are working with Magam, an AI-native programmatic whiteboard."

2. 현재 파일 정보
   - 파일 경로: {currentFile}
   - 파일 내용 (전체 또는 요약)

3. Magam 컴포넌트 API 요약
   - Canvas, MindMap, Node, Shape, Sticky, Text, Edge 등
   - 기본 사용 패턴 및 필수 규칙

4. 프로젝트 구조
   - 작업 디렉토리 내 .tsx 파일 목록

5. 출력 규칙
   - @magam/core에서 import
   - default export function 형태
   - Tailwind 클래스 사용 가능
```

### 11.5 변경 지점 요약

| 레이어 | 파일/모듈 | 변경 내용 |
|--------|----------|----------|
| Frontend | `app/store/graph.ts` | chat 상태 슬라이스 추가 (또는 별도 `chat.ts` 스토어) |
| Frontend | `app/components/chat/` | ChatPanel, MessageList, ChatInput, AISelector 컴포넌트 신규 (권한 모드 토글 포함) |
| Frontend | `app/components/ui/Header.tsx` | 채팅 토글 버튼 추가 |
| Frontend | `app/app/api/chat/` | 채팅 API 라우트 (CLI 실행 프록시) |
| Backend | `libs/cli/src/chat/` | CLIDetector, CLIAdapter(SDK 래퍼), PromptBuilder, SessionManager 신규 |
| Backend | `libs/cli/src/server/http.ts` | `/chat/send`, `/chat/providers`, `/chat/stop` 엔드포인트 추가 |
| Shared | `libs/shared/src/` | 채팅 관련 공용 타입 정의 (`permissionMode: auto\|interactive`) |

기본 권한 모드는 `auto`이며, UI에서 `자동 승인`/`확인`으로 전환할 수 있다.

---

## 12. 단계별 구현 계획

### Phase 1: CLI 감지 및 어댑터 기반 구축

- CLI 감지 모듈 구현 (which/where + version 확인)
- CLI 어댑터 인터페이스 정의 및 Claude Code 어댑터 구현
- 프로세스 spawn/관리 유틸리티
- 단위 테스트

완료 기준: Claude Code 설치 여부를 감지하고 프로세스를 안전하게 실행/종료할 수 있다.

### Phase 2: 시스템 프롬프트 및 서버 엔드포인트

- PromptBuilder 구현 (현재 파일, 컴포넌트 API, 프로젝트 구조 수집)
- HTTP 엔드포인트 추가 (`/chat/providers`, `/chat/send`, `/chat/stop`)
- 응답 스트리밍 (Server-Sent Events 또는 WebSocket)
- 에러 핸들링 및 타임아웃

완료 기준: HTTP 요청으로 Claude Code를 실행하고 응답을 스트리밍으로 수신할 수 있다.

### Phase 3: 채팅 UI 기본 구현

- Zustand 채팅 상태 슬라이스 추가
- ChatPanel 컴포넌트 (메시지 리스트, 입력, AI 선택)
- 메시지 전송/수신 흐름 연결
- 기본 마크다운 렌더링

완료 기준: 채팅 UI에서 메시지를 입력하면 AI 응답이 스트리밍되어 표시된다.

### Phase 4: 파일 변경 연동 및 캔버스 반영

- AI 파일 변경 → 기존 파일 감시 → 캔버스 자동 업데이트 검증
- 파일 변경 알림 배지 (채팅 내 표시)
- 동시 변경 충돌 방지 (AI 처리 중 사용자 편집 경고)

완료 기준: AI가 파일을 수정하면 캔버스가 자동 업데이트되고, 채팅에 변경 파일이 표시된다.

### Phase 5: 추가 CLI 어댑터 및 UX 완성

- Gemini CLI, Codex CLI 어댑터 추가
- 미설치 안내 UI
- 채팅 히스토리 관리 (세션별)
- 중단 기능, 에러 재시도
- 단축키 연결

완료 기준: 3개 CLI 도구를 자유롭게 전환하여 사용할 수 있다.

### Phase 6: 품질 및 성능 마무리

- 스트리밍 성능 최적화
- 프로세스 안정성 (좀비 프로세스 방지, 비정상 종료 처리)
- 접근성 점검
- 보안 검토 (CLI 인자 인젝션 방지)
- E2E 테스트

완료 기준: NFR 전체 충족, 보안 검토 완료.

---

## 13. 성공 지표

1. **채팅 사용률**: 활성 사용자 중 채팅 기능 사용 비율 50% 이상
2. **다이어그램 생성 효율**: AI 채팅을 통한 다이어그램 생성/수정 성공률 80% 이상
3. **응답 만족도**: AI 응답 후 추가 수동 편집 비율 40% 이하
4. **도구 다양성**: 2개 이상의 AI 도구가 실제로 사용되는 비율 20% 이상
5. **에러율**: 채팅 관련 오류(프로세스 실패, 파싱 에러 등) 2% 미만

---

## 14. 리스크 및 대응

| 리스크 | 영향 | 심각도 | 대응 |
|--------|------|--------|------|
| CLI 도구 인터페이스 변경 | 어댑터 호환성 깨짐 | **낮음** (SDK가 흡수) | SDK 버전 업그레이드로 대응, Gemini만 직접 분기 필요 |
| CLI 프로세스 무한 대기/행 | 리소스 누수, UX 저하 | **낮음** (SDK가 관리) | SDK timeout 옵션 활용, Gemini는 자체 타임아웃 구현 |
| 사용자 CLI 미설치 | 기능 사용 불가 | 중간 | 명확한 안내 UI, 설치 가이드, 대체 수단 제안 |
| AI의 잘못된 파일 수정 | 다이어그램 깨짐 | 중간 | 수정 전 파일 백업, undo 기능, 변경 diff 표시 |
| 보안: CLI 인자 인젝션 | 임의 명령 실행 | **낮음** (SDK가 격리) | SDK의 `allowedTools` 옵션으로 도구 제한, Gemini는 `shell: false` 강제 |
| Gemini CLI stdout 파싱 불안정 | 응답 표시 오류 | 중간 | raw 텍스트 폴백 표시, NDJSON 모드 우선 사용, 에러 격리 |
| 대용량 프로젝트 컨텍스트 | CLI 토큰 한도 초과 | 중간 | 컨텍스트 크기 제한, 관련 파일만 선별, 요약 전략 |
| SDK 패키지 크기 | 번들 사이즈 증가 | 낮음 | 서버 사이드에서만 사용 (클라이언트 번들에 미포함) |

---

## 15. 오픈 질문

1. **세션 영속성**: 채팅 히스토리를 파일 시스템에 저장할지, 메모리에서만 유지할지? (SDK의 세션 resume 기능 활용 가능)
2. **멀티 파일 편집**: AI가 여러 파일을 동시에 수정할 때의 UX는? (변경 파일 목록 표시? 개별 확인?)
3. **권한 모델**: AI CLI 실행 시 사용자에게 매번 확인을 받을지, 세션 단위로 허용할지? (SDK의 `allowedTools` 활용)
4. **컨텍스트 범위**: 시스템 프롬프트에 현재 파일만 포함할지, 전체 프로젝트 파일을 포함할지?
5. **CLI 동시 실행**: 이전 요청이 처리 중일 때 새 요청을 큐잉할지, 이전 요청을 중단할지?
6. **채팅 패널 위치**: 오른쪽 사이드바 고정 vs 하단 패널 vs 사용자 선택 가능?
7. **SDK 버전 고정 전략**: SDK 버전을 pinning할지, range로 허용할지?
