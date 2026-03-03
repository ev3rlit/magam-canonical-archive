# Chat Session Management PRD (Magam Local AI Chat)

## 1. 배경

현재 Local AI Chat은 단일 세션 중심으로 동작하여 다음 문제가 있다.

- 여러 세션을 동시에 다루기 어렵다.
- 과거 채팅 기록을 탐색/조회하기 어렵다.
- 진행 중인 대화의 모델 전환 UX가 약하다.
- 불필요한 세션 정리(삭제)가 어렵다.
- 세션을 목적별로 그룹핑해 관리할 수 없다.

이 문서는 위 문제를 해결하기 위한 **Chat Session Management** 기능 요구사항을 정의한다.

---

## 2. 목표

### 2.1 Goals

1. 이전 세션 기록을 리스트/검색으로 확인할 수 있다.
2. 이전 세션을 선택해 이어서 채팅할 수 있다.
3. 현재 세션에서 모델(provider)을 변경하여 계속 대화할 수 있다.
4. 세션 및 세션 기록을 삭제할 수 있다.
5. 세션을 그룹(예: 프로젝트/주제/업무)으로 묶어 관리할 수 있다.

### 2.2 Non-Goals

1. 멀티 유저 협업 동기화(다중 사용자 실시간 공유)
2. 원격 DB 기반 계정 동기화(클라우드 sync)
3. 메시지 단위 세분화 권한 모델(역할/ACL)

---

## 3. 사용자 스토리

1. **기록 조회**
   - 사용자로서, 지난주에 했던 AI 대화를 다시 보고 싶다.
   - 그래서 세션 목록에서 날짜/제목/모델 기준으로 찾아 열람하고 싶다.

2. **세션 이어하기**
   - 사용자로서, 어제 하던 다이어그램 작업을 이어서 하고 싶다.
   - 그래서 이전 세션을 열고 바로 새 메시지를 보낼 수 있어야 한다.

3. **모델 변경**
   - 사용자로서, 같은 세션에서 Claude에서 Codex로 바꿔 후속 질문을 하고 싶다.
   - 그래서 컨텍스트를 유지한 채 모델만 전환하고 싶다.

4. **세션 삭제**
   - 사용자로서, 테스트성 잡다한 세션을 정리하고 싶다.
   - 그래서 세션 단위 삭제 및(선택적으로) 그룹 단위 정리가 가능해야 한다.

5. **세션 그룹핑**
   - 사용자로서, 프로젝트별로 세션을 모아 관리하고 싶다.
   - 그래서 세션을 그룹에 배치하고 그룹별로 접기/필터링하고 싶다.

---

## 4. 핵심 기능 요구사항 (Functional Requirements)

| ID | 요구사항 | Acceptance Criteria |
|---|---|---|
| FR-1 | 세션 목록 조회 | 세션 리스트에서 제목, 최근 활동 시각, 메시지 수, 모델 정보 확인 가능 |
| FR-2 | 세션 검색/필터 | 키워드, 모델, 기간, 그룹 기준 필터 가능 |
| FR-3 | 세션 열람 | 세션 선택 시 과거 메시지 타임라인 전체 로드 |
| FR-4 | 세션 이어서 채팅 | 과거 세션 열람 후 즉시 메시지 전송 가능, 같은 sessionId로 이어짐 |
| FR-5 | 세션 내 모델 변경 | 현재 세션에서 provider 변경 가능, 변경 이벤트가 시스템 메시지로 기록됨 |
| FR-6 | 세션 삭제 | 단일 세션 삭제 가능, 삭제 전 확인 모달 표시 |
| FR-7 | 그룹 생성/수정/삭제 | 그룹 CRUD 가능, 그룹명/컬러/정렬 순서 관리 |
| FR-8 | 세션 그룹 배정 | 세션 생성 시 기본 그룹 배정 가능, drag & drop 또는 메뉴로 이동 가능 |
| FR-9 | 그룹별 뷰 | 그룹 접기/펼치기, 그룹별 카운트, 최근활동 기준 정렬 지원 |
| FR-10 | 데이터 영속성 | 앱 재시작 후에도 세션/메시지/그룹 정보 유지 |

---

## 5. 비기능 요구사항 (Non-Functional Requirements)

| ID | 항목 | 기준 |
|---|---|---|
| NFR-1 | 세션 리스트 로딩 | 최근 100개 세션 로딩 p95 500ms 이하 |
| NFR-2 | 메시지 히스토리 로딩 | 세션 1,000 메시지 로딩 p95 1초 이하(가상화 적용) |
| NFR-3 | 안정성 | 세션 전환/모델 전환 중 UI 크래시 0건 |
| NFR-4 | 무결성 | 세션 삭제 시 인덱스/그룹 참조 dangling 0건 |
| NFR-5 | 보안 | 프로젝트 루트 외 경로에 세션 저장 금지 |

---

## 6. UX 제안

### 6.1 좌측 Session Drawer 추가

- 섹션: `Groups` / `All Sessions`
- 각 세션 아이템: 제목, 모델 배지, 마지막 활동 시간, 메시지 수
- Quick actions: 이어하기, 모델 변경, 삭제, 그룹 이동

### 6.2 채팅 헤더 확장

- 현재 세션명
- 현재 모델 선택 드롭다운
- 그룹 표시/변경 버튼
- `New Session` 버튼

### 6.3 삭제 UX

- 삭제 시 확인 모달:
  - “세션 기록이 영구 삭제됩니다.”
  - 체크박스: “연결된 draft metadata도 함께 삭제” (옵션)
- 그룹 삭제 시 UX 정책:
  - 하위 세션은 자동으로 `All Sessions`(groupId = null)로 이동
  - 현재 필터가 삭제된 그룹인 경우 UI는 자동으로 `All Sessions`로 fallback

### 6.4 모델 전환 UX

- 세션 내 모델 변경 시 시스템 메시지 자동 삽입:
  - `System: Provider switched from Claude Code to Codex CLI`
- 전환 후 다음 사용자 메시지부터 새 provider 적용

---

## 7. 저장소/ORM 선택

- DB: SQLite (`<workspace>/.magam/chat.db`)
- ORM: **Drizzle ORM**
- 선택 이유:
  1. Bun + TypeScript + SQLite 조합에서 경량/고성능
  2. SQL 제어권과 타입 안정성의 균형이 좋음
  3. 세션/메시지/그룹 구조의 인덱스/마이그레이션 관리에 적합

권장 패키지:

```bash
bun add drizzle-orm
bun add -d drizzle-kit
```

---

## 8. 데이터 모델 (초안)

```ts
export interface ChatSession {
  id: string;
  title: string;
  groupId: string | null;
  providerId: 'claude' | 'gemini' | 'codex';
  createdAt: number;
  updatedAt: number;
  archivedAt?: number;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  providerId?: 'claude' | 'gemini' | 'codex';
  createdAt: number;
  metadata?: Record<string, unknown>;
}

export interface SessionGroup {
  id: string;
  name: string;
  color?: string;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
}
```

---

## 9. API / 엔드포인트 제안

### Session
- `GET /chat/sessions`
- `GET /chat/sessions/:id`
- `POST /chat/sessions`
- `PATCH /chat/sessions/:id` (title, providerId, groupId)
- `DELETE /chat/sessions/:id`

### Message History
- `GET /chat/sessions/:id/messages?cursor=&limit=`
  - cursor 규격(v1): `createdAt:id` (예: `1708070400000:msg_abc123`)
  - 정렬 기준: `createdAt ASC, id ASC`
- `POST /chat/send`
  - v1 호환 정책: `sessionId`가 없으면 서버가 새 세션을 자동 생성해 처리
  - v2 목표: `sessionId` 필수화 (브레이킹 변경)

### Group
- `GET /chat/groups`
- `POST /chat/groups`
- `PATCH /chat/groups/:id`
- `DELETE /chat/groups/:id`

---

## 10. 마이그레이션 전략

1. 기존 메모리 기반 session store에서 SQLite 영속 store로 점진 전환한다.
2. 초기 릴리스(v1)는 로컬 **SQLite** 저장소를 사용한다 (`<workspace>/.magam/chat.db`).
3. 기존 단일 세션 사용자에 대해 `Default` 그룹 자동 생성
4. 기존 active session을 신규 schema로 자동 변환

---

## 11. 리스크 및 대응

1. **히스토리 증가에 따른 성능 저하**
   - 대응: 페이징 + 리스트/메시지 가상화 + 인덱스
2. **모델 전환 시 컨텍스트 불일치**
   - 대응: 전환 시스템 메시지 + provider별 prompt adapter
3. **삭제 오동작으로 데이터 손실**
   - 대응: 확인 모달 + soft delete 옵션(phase2)
4. **그룹 구조 복잡화**
   - 대응: 1단계는 단일 depth 그룹만 지원

---

## 12. 단계별 출시 계획

### Phase 1 (핵심)
- 세션 목록/조회/이어하기
- 모델 전환(세션 내)
- 세션 삭제

### Phase 2 (정리/구조화)
- 그룹 CRUD
- 세션 그룹 이동/필터링

### Phase 3 (품질)
- 성능 최적화(가상화/페이징)
- soft delete 및 복구 UX

---

## 13. 성공 지표

1. 세션 재사용률: 생성된 세션 중 2회 이상 재방문 비율 40%+
2. 평균 재시작 시간: 과거 세션 열고 첫 메시지 전송까지 10초 이내
3. 세션 관리 만족도(정성): “기록 찾기/이어하기 쉽다” 피드백 80%+
4. 오류율: 세션 로드/삭제/전환 API 오류율 1% 미만
