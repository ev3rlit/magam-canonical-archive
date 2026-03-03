# Chat Session Management 구현 계획서

## 1. 문서 목적

`docs/features/chat-session-management/README.md`를 기준으로,
세션 관리 기능을 실제 개발 가능한 단위로 분해한 실행 계획이다.

참고: 기존 Local AI Chat PRD의 메모리 기반 세션 제약은 본 문서에서 정의한 SQLite 영속화/다중 세션 정책으로 대체한다.

---

## 2. 구현 범위

### In Scope
1. 이전 세션 목록/조회/검색
2. 이전 세션 이어서 채팅
3. 세션 내 모델(provider) 변경
4. 세션 삭제
5. 세션 그룹핑(그룹 CRUD + 세션 이동)
6. 로컬 영속 저장소 도입

### Out of Scope
1. 멀티 유저 공유 세션
2. 클라우드 동기화
3. 그룹 중첩(depth>1)

---

## 3. 기술 결정

## 3.1 저장소 + ORM 선택 (확정)

- DB: **SQLite** (`<workspace>/.magam/chat.db`)
- ORM: **Drizzle ORM**
- 마이그레이션: **drizzle-kit**

선정 이유:
1. Bun + TypeScript 환경에서 경량/빠른 실행 성능
2. SQL 제어권과 타입 안정성 균형
3. 세션/메시지/그룹 쿼리(필터/정렬/페이징) 구현에 적합

패키지:

```bash
bun add drizzle-orm
bun add -d drizzle-kit
```

> v1은 SQLite + Drizzle 조합으로 고정한다.

## 3.2 아키텍처 추가 포인트

- `libs/cli/src/chat/repository/` 신규
  - `db.ts` (Drizzle client 초기화)
  - `schema.ts` (Drizzle table schema)
  - `session-repo.ts`
  - `message-repo.ts`
  - `group-repo.ts`
- 루트에 `drizzle.config.ts` 추가 (마이그레이션 경로/DB 경로 설정)
- 기존 `session.ts`는 런타임 상태(활성 프로세스/abort) 담당
- 영속 데이터는 repository 계층(Drizzle)에서 관리

---

## 4. DB 스키마 (SQLite)

```sql
CREATE TABLE session_groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE chat_sessions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  group_id TEXT,
  provider_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  archived_at INTEGER,
  FOREIGN KEY (group_id) REFERENCES session_groups(id)
);

CREATE TABLE chat_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  provider_id TEXT,
  created_at INTEGER NOT NULL,
  metadata_json TEXT,
  FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
);

CREATE INDEX idx_sessions_updated_at ON chat_sessions(updated_at DESC);
CREATE INDEX idx_sessions_group_id ON chat_sessions(group_id);
CREATE INDEX idx_messages_session_created_at ON chat_messages(session_id, created_at ASC);
```

### 4.1 Drizzle 운영 규칙

1. 스키마 정의는 `libs/cli/src/chat/repository/schema.ts` 단일 소스로 관리
2. 마이그레이션 생성: `bunx drizzle-kit generate`
3. 마이그레이션 적용: 앱 시작 시 safe-migrate 또는 배포 스크립트로 적용
4. Raw SQL은 성능/복잡 쿼리에 한해 제한적으로 사용하고 기본은 Drizzle query builder 사용

---

## 5. API 구현 상세

## 5.1 세션

1. `GET /chat/sessions`
   - query: `groupId`, `providerId`, `q`, `cursor`, `limit`
   - return: 세션 목록 + nextCursor

2. `GET /chat/sessions/:id`
   - return: session metadata

3. `POST /chat/sessions`
   - body: `{ title?, providerId?, groupId? }`
   - default title: `New Chat {yyyy-mm-dd hh:mm}`

4. `PATCH /chat/sessions/:id`
   - body: `{ title?, providerId?, groupId? }`
   - providerId 변경 시 system message 자동 생성

5. `DELETE /chat/sessions/:id`
   - hard delete(v1)
   - 향후 soft delete 확장 가능

## 5.2 메시지

6. `GET /chat/sessions/:id/messages`
   - query: `cursor`, `limit` (기본 50)
   - cursor 규격(v1): `createdAt:id` (예: `1708070400000:msg_abc123`)
   - 정렬 기준: `createdAt ASC, id ASC`
   - 오래된 메시지부터 페이지네이션

7. `POST /chat/send`
   - 기존 엔드포인트 확장
   - v1 호환 정책: `sessionId` 누락 시 서버가 새 세션 자동 생성
   - v2 목표: `sessionId` 필수화
   - assistant chunk 저장은 완료 시점에 1 message로 커밋 (중간 버퍼링)

## 5.3 그룹

8. `GET /chat/groups`
9. `POST /chat/groups`
10. `PATCH /chat/groups/:id`
11. `DELETE /chat/groups/:id`
   - 정책: 그룹 삭제 시 하위 세션은 `groupId = null`로 이동
   - UI 정책: 현재 필터가 삭제된 그룹이면 `All Sessions`로 자동 fallback

---

## 6. 프론트엔드 구현 상세

## 6.1 Store 확장 (`app/store/chat.ts`)

```ts
interface ChatState {
  groups: SessionGroup[];
  sessions: ChatSessionSummary[];
  currentSessionId: string | null;
  messagesBySession: Record<string, ChatMessage[]>;
  activeProviderId: ProviderId | null;

  loadGroups(): Promise<void>;
  loadSessions(filter?: SessionFilter): Promise<void>;
  openSession(sessionId: string): Promise<void>;
  createSession(input?: CreateSessionInput): Promise<string>;
  deleteSession(sessionId: string): Promise<void>;
  switchProvider(providerId: ProviderId): Promise<void>;
  moveSessionToGroup(sessionId: string, groupId: string | null): Promise<void>;
}
```

## 6.2 UI 컴포넌트

- `app/components/chat/SessionSidebar.tsx` (신규)
  - 그룹 섹션 + 세션 목록
  - 검색 입력
  - 그룹 접기/펼치기

- `app/components/chat/SessionItem.tsx` (신규)
  - 제목, 모델 배지, 최근 활동, quick action(삭제/이동)

- `app/components/chat/GroupManager.tsx` (신규)
  - 그룹 생성/수정/삭제 모달

- `ChatPanel.tsx` 업데이트
  - 헤더에 현재 세션명 + provider switch + new session

---

## 7. 단계별 구현 일정

### Phase 1: Persistence + Session APIs
- SQLite repository 구현
- 세션/메시지 API 구현
- 기존 send 경로와 sessionId 결합

**완료 기준**
- 앱 재시작 후 세션/메시지 유지
- 이전 세션 열람/이어서 전송 가능

### Phase 2: Provider Switch + Deletion
- 세션 내 provider 변경 API/UX
- 삭제 플로우 + 확인 모달
- 시스템 메시지 기록

**완료 기준**
- 같은 sessionId에서 provider 바뀌고 후속 대화 정상 동작
- 삭제 후 목록/인덱스 무결성 유지

### Phase 3: Grouping
- 그룹 CRUD API
- 세션 그룹 이동/필터 UI
- 그룹 삭제 정책 처리(null 이동)

**완료 기준**
- 그룹 단위 세션 관리 가능
- 그룹 기반 탐색 성능 문제 없음

### Phase 4: QA/성능/안정화
- 페이지네이션/가상화
- 통합/E2E/회귀 테스트
- 성능 목표 검증

**완료 기준**
- NFR 달성
- 릴리스 체크리스트 통과

---

## 8. 테스트 계획

## 8.1 단위 테스트
- Repository CRUD 테스트
- provider switch 시스템 메시지 생성 테스트
- session delete 시 message cascade 또는 트랜잭션 검증

## 8.2 통합 테스트
- `POST /chat/send` + sessionId + history load end-to-end
- 그룹 생성 → 세션 이동 → 필터 조회

## 8.3 E2E 시나리오
1. 세션 생성 → 메시지 전송 → 앱 재시작 → 기록 유지 확인
2. 이전 세션 선택 → 이어서 채팅
3. 세션 중 provider 변경 후 응답 provider 반영
4. 세션 삭제 후 목록/상세 접근 불가 확인
5. 그룹 생성/이동/삭제 플로우

---

## 9. 리스크 & 대응

1. **데이터 마이그레이션 복잡도**
   - 대응: v1은 신규 DB 생성 + Default 그룹 자동 구성

2. **대용량 히스토리 렌더 성능**
   - 대응: 메시지 가상화 + 점진 로딩 + limit/cursor

3. **provider 전환 시 답변 톤/형식 불일치**
   - 대응: provider 전환 시스템 메시지 + prompt-builder에 provider 컨텍스트 명시

4. **삭제 사고**
   - 대응: 확인 모달 필수 + 추후 soft delete 옵션 도입

---

## 10. 작업 체크리스트

### Backend
- [ ] Drizzle 패키지/설정 추가 (`drizzle-orm`, `drizzle-kit`, `drizzle.config.ts`)
- [ ] Drizzle schema 정의 (`schema.ts`)
- [ ] SQLite 초기화 모듈 (`db.ts`)
- [ ] Session/Message/Group repository (Drizzle 기반)
- [ ] `/chat/sessions*` API
- [ ] `/chat/groups*` API
- [ ] `/chat/send` sessionId 호환 연동(v1 자동 생성 + v2 필수화 준비)
- [ ] provider switch 시스템 메시지 저장

### Frontend
- [ ] SessionSidebar/SessionItem/GroupManager 컴포넌트
- [ ] 검색/필터/정렬 UI
- [ ] 세션 이어하기 UX
- [ ] 모델 변경 UX
- [ ] 삭제 확인 모달
- [ ] 그룹 이동 UI

### Quality
- [ ] 단위/통합/E2E 테스트
- [ ] 성능 측정 및 튜닝
- [ ] 문서 최종 정리

---

## 11. 파일 구조 제안

```
docs/features/chat-session-management/
├── README.md
└── implementation-plan.md

drizzle.config.ts

libs/cli/src/chat/
├── repository/
│   ├── db.ts
│   ├── schema.ts
│   ├── session-repo.ts
│   ├── message-repo.ts
│   └── group-repo.ts
└── handler.ts (확장)

app/components/chat/
├── SessionSidebar.tsx
├── SessionItem.tsx
└── GroupManager.tsx

app/store/
└── chat.ts (확장)
```
