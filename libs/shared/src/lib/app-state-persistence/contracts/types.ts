export const APP_STATE_SESSION_SINGLETON_KEY = 'global';

export type AppWorkspaceStatus = 'ok' | 'missing' | 'not-directory' | 'unreadable';
export type AppPreferenceValue = Record<string, unknown> | string | number | boolean | null;

export interface AppWorkspaceRecord {
  id: string;
  rootPath: string;
  displayName: string;
  status: AppWorkspaceStatus;
  isPinned: boolean;
  lastOpenedAt?: Date | null;
  lastSeenAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface AppWorkspaceUpsertInput {
  id: string;
  rootPath: string;
  displayName: string;
  status: AppWorkspaceStatus;
  isPinned?: boolean;
  lastOpenedAt?: Date | null;
  lastSeenAt?: Date | null;
}

export interface AppWorkspaceSessionRecord {
  singletonKey: string;
  activeWorkspaceId?: string | null;
  updatedAt?: Date;
}

export interface AppWorkspaceSessionUpdateInput {
  activeWorkspaceId?: string | null;
}

export interface AppRecentCanvasRecord {
  workspaceId: string;
  documentPath: string;
  lastOpenedAt?: Date | null;
  updatedAt?: Date;
}

export interface AppRecentCanvasUpsertInput {
  workspaceId: string;
  documentPath: string;
  lastOpenedAt?: Date | null;
}

export type AppPreferenceKey =
  | 'theme.mode'
  | 'font.globalFamily'
  | 'workspace.lastActiveDocumentSession';

export interface AppPreferenceRecord {
  key: AppPreferenceKey | string;
  valueJson: AppPreferenceValue;
  updatedAt?: Date;
}

export interface AppPreferenceUpsertInput {
  key: AppPreferenceKey | string;
  valueJson: AppPreferenceValue;
}
