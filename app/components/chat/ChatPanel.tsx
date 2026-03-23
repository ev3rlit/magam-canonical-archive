'use client';

import React, { useEffect, useMemo } from 'react';
import { X } from 'lucide-react';
import { useChatStore, type ChatProgressStage } from '@/store/chat';
import { useChatUiStore } from '@/store/chatUi';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { SetupGuide } from './SetupGuide';
import { SessionSidebar } from './SessionSidebar';
import { GroupManager } from './GroupManager';
import { Button } from '@/components/ui/Button';

const STAGE_LABELS: Record<ChatProgressStage, string> = {
  preparing: '컨텍스트 준비 중',
  starting: '어댑터 시작 중',
  working: '응답 생성 중',
  writing: '파일 변경 반영 중',
  finishing: '마무리 중',
};

export const ChatPanel: React.FC = () => {
  const { isOpen, setOpen } = useChatUiStore();
  const {
    status,
    providers,
    selectedProviderId,
    selectedModelByProvider,
    reasoningEffort,
    messages,
    sessions,
    groups,
    sessionId,
    currentSessionTitle,
    error,
    loadProviders,
    loadSessions,
    createSession,
    openSession,
    updateSession,
    deleteSession,
    loadGroups,
    createGroup,
    updateGroup,
    deleteGroup,
    selectProvider,
    setSelectedModel,
    setReasoningEffort,
    sendMessage,
    stopGeneration,
    permissionMode,
    setPermissionMode,
    progressEvents,
    currentStage,
    activeRequestId,
  } = useChatStore();

  useEffect(() => {
    if (!isOpen) return;

    if (providers.length === 0 && status !== 'loadingProviders') {
      void loadProviders();
    }

    void loadSessions({ limit: 100 });
    void loadGroups();
  }, [isOpen, providers.length, status, loadProviders, loadSessions, loadGroups]);

  const isSending = status === 'sending';
  const stageLabel = currentStage ? STAGE_LABELS[currentStage] : '응답 생성 중';
  const visibleProgress = useMemo(() => [...progressEvents].reverse().slice(0, 8), [progressEvents]);
  const selectedModel =
    selectedProviderId ? selectedModelByProvider[selectedProviderId] ?? '' : '';

  if (!isOpen) return null;

  return (
    <aside className="absolute right-4 top-16 bottom-4 z-40 flex w-[980px] max-w-[calc(100%-2rem)] overflow-hidden rounded-xl bg-card/88 shadow-floating shadow-[inset_0_0_0_1px_rgb(var(--color-border)/0.12)] backdrop-blur-glass">
      <SessionSidebar
        sessions={sessions}
        groups={groups}
        currentSessionId={sessionId}
        onOpenSession={(id) => void openSession(id)}
        onDeleteSession={(id) => void deleteSession(id)}
        onCreateSession={() => void createSession({ providerId: selectedProviderId ?? undefined })}
        onFilterGroup={(groupId, q) => void loadSessions({ groupId, q, limit: 100 })}
        onUpdateSession={(id, patch) => void updateSession(id, patch)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between px-3 py-2 shadow-[inset_0_-1px_0_rgb(var(--color-border)/0.08)]">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Local AI Chat</h2>
            <p className="truncate text-[11px] text-foreground/52">
              {currentSessionTitle ?? 'No active session'}
            </p>
          </div>
          <Button
            className="rounded-md"
            onClick={() => setOpen(false)}
            aria-label="Close chat"
            size="icon"
            variant="ghost"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <GroupManager
          groups={groups}
          onCreateGroup={createGroup}
          onUpdateGroup={updateGroup}
          onDeleteGroup={deleteGroup}
        />

        <div className="px-3 pt-2 space-y-2">
          <div className="flex items-center justify-between rounded-lg bg-muted/72 px-2 py-1.5 shadow-[inset_0_0_0_1px_rgb(var(--color-border)/0.10)]">
            <span className="text-[11px] text-foreground/62">권한 모드</span>
            <div className="inline-flex overflow-hidden rounded-pill bg-card shadow-[inset_0_0_0_1px_rgb(var(--color-border)/0.10)]">
              <button
                type="button"
                className={`px-2 py-1 text-[11px] ${permissionMode === 'auto' ? 'bg-primary text-primary-foreground' : 'bg-transparent text-foreground/58'}`}
                onClick={() => setPermissionMode('auto')}
                disabled={isSending}
                aria-label="자동 승인 모드"
              >
                자동 승인
              </button>
              <button
                type="button"
                className={`px-2 py-1 text-[11px] ${permissionMode === 'interactive' ? 'bg-primary text-primary-foreground' : 'bg-transparent text-foreground/58'}`}
                onClick={() => setPermissionMode('interactive')}
                disabled={isSending}
                aria-label="확인 모드"
              >
                확인
              </button>
            </div>
          </div>

          {(isSending || progressEvents.length > 0) && (
            <details className="rounded-lg bg-muted/72 shadow-[inset_0_0_0_1px_rgb(var(--color-border)/0.10)]" open={isSending}>
              <summary className="flex cursor-pointer list-none items-center justify-between px-2 py-1.5 text-[11px] font-medium text-foreground/78">
                <span>진행 중 로그</span>
                <span className="text-[10px] text-foreground/48">{stageLabel}</span>
              </summary>
              <ul className="max-h-24 space-y-1 overflow-y-auto px-2 py-1.5">
                {visibleProgress.length === 0 ? (
                  <li className="text-[11px] text-foreground/52">준비 중…</li>
                ) : (
                  visibleProgress.map((entry) => (
                    <li key={entry.id} className="truncate text-[11px] text-foreground/62">
                      {entry.content}
                    </li>
                  ))
                )}
              </ul>
            </details>
          )}
        </div>

        {providers.length === 0 && <SetupGuide />}

        <MessageList
          messages={messages}
          isSending={isSending}
          activeRequestId={activeRequestId}
          streamingLabel={stageLabel}
        />

        {error && (
          <div className="mx-3 mb-2 rounded-lg bg-danger/12 px-2 py-1 text-xs text-danger shadow-[inset_0_0_0_1px_rgb(var(--color-danger)/0.16)]">
            {error}
          </div>
        )}

        <ChatInput
          providers={providers}
          selectedProviderId={selectedProviderId}
          selectedModel={selectedModel}
          reasoningEffort={reasoningEffort}
          onSelectProvider={selectProvider}
          onSelectModel={setSelectedModel}
          onSelectEffort={setReasoningEffort}
          disabled={status === 'loadingProviders'}
          isSending={isSending}
          onSend={sendMessage}
          onStop={stopGeneration}
        />
      </div>
    </aside>
  );
};
