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
    <aside className="absolute right-4 top-16 bottom-4 z-40 w-[980px] max-w-[calc(100%-2rem)] rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900 flex overflow-hidden">
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
        <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2 dark:border-slate-800">
          <div>
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Local AI Chat</h2>
            <p className="text-[11px] text-slate-500 truncate">
              {currentSessionTitle ?? 'No active session'}
            </p>
          </div>
          <button
            type="button"
            className="rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-800"
            onClick={() => setOpen(false)}
            aria-label="Close chat"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <GroupManager
          groups={groups}
          onCreateGroup={createGroup}
          onUpdateGroup={updateGroup}
          onDeleteGroup={deleteGroup}
        />

        <div className="px-3 pt-2 space-y-2">
          <div className="flex items-center justify-between rounded-md border border-slate-200 px-2 py-1.5 dark:border-slate-800">
            <span className="text-[11px] text-slate-600 dark:text-slate-300">권한 모드</span>
            <div className="inline-flex rounded-md border border-slate-300 dark:border-slate-700 overflow-hidden">
              <button
                type="button"
                className={`px-2 py-1 text-[11px] ${permissionMode === 'auto' ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'bg-white text-slate-600 dark:bg-slate-900 dark:text-slate-300'}`}
                onClick={() => setPermissionMode('auto')}
                disabled={isSending}
                aria-label="자동 승인 모드"
              >
                자동 승인
              </button>
              <button
                type="button"
                className={`px-2 py-1 text-[11px] ${permissionMode === 'interactive' ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'bg-white text-slate-600 dark:bg-slate-900 dark:text-slate-300'}`}
                onClick={() => setPermissionMode('interactive')}
                disabled={isSending}
                aria-label="확인 모드"
              >
                확인
              </button>
            </div>
          </div>

          {(isSending || progressEvents.length > 0) && (
            <details className="rounded-md border border-slate-200 dark:border-slate-800" open={isSending}>
              <summary className="cursor-pointer list-none px-2 py-1.5 text-[11px] font-medium text-slate-700 dark:text-slate-200 flex items-center justify-between">
                <span>진행 중 로그</span>
                <span className="text-[10px] text-slate-500">{stageLabel}</span>
              </summary>
              <ul className="max-h-24 overflow-y-auto border-t border-slate-100 px-2 py-1.5 dark:border-slate-800 space-y-1">
                {visibleProgress.length === 0 ? (
                  <li className="text-[11px] text-slate-500">준비 중…</li>
                ) : (
                  visibleProgress.map((entry) => (
                    <li key={entry.id} className="text-[11px] text-slate-600 dark:text-slate-300 truncate">
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
          <div className="mx-3 mb-2 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
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
