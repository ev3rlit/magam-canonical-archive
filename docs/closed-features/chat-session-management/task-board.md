# Chat Session Management Task Board

## Completed

### Sprint A — Core Session UX
- [x] T1. Group 수정 UI (이름/색상)
- [x] T2. Session item provider quick-switch
- [x] T3. SessionSidebar 검색 + debounce

### Sprint B — Session Editing UX
- [x] T4. Session 제목 inline rename
- [x] T5. Session 그룹 이동 dropdown
- [x] T6. 검색어 하이라이트

### Sprint C — UX Polish
- [x] T7. 세션 정렬 옵션 (최근순/제목순)
- [x] T8. 검색 결과 건수 표시
- [x] T9. provider 변경 확인 모달
- [x] T10. 세션 카드 마지막 업데이트 시간 표시
- [x] T11. 검색 결과 없음(empty) 상태 문구 개선
- [x] T12. 브라우저 confirm 제거 후 커스텀 확인 다이얼로그 적용

### Sprint D — Backend Stability / Persistence
- [x] T13. Drizzle 스키마 + 저장소 구현
- [x] T14. `/chat/sessions*` API 구현
- [x] T15. `/chat/groups*` API 구현
- [x] T16. `/chat/sessions/:id/messages` cursor pagination 구현
- [x] T17. `/chat/send` v1 sessionId 호환(누락 시 자동 생성) 구현
- [x] T18. provider 변경 시 system message 기록 구현

### Sprint E — Test & Migration
- [x] T19. repository 단위 테스트 추가
- [x] T20. http.spec 신규 API 케이스 추가 및 실행 정상화
- [x] T21. drizzle migration 파일 생성 (`0000`, `0001`)
- [x] T22. db 초기화 시 migration 우선 적용 + fallback bootstrap

## Optional Follow-ups (not blocking)
- [x] F1. Playwright E2E 시나리오(세션 생성/이어서 대화/그룹 이동) 추가
- [x] F2. 접근성 점검(모달 keyboard close + focus init)
- [x] F3. provider 전환 모달 시각/문구 polishing
