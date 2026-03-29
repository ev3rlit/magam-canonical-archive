import { asc, desc, eq } from 'drizzle-orm';
import type {
  AppPreferenceValue,
  AppPreferenceRecord,
  AppPreferenceUpsertInput,
  AppRecentCanvasRecord,
  AppRecentCanvasUpsertInput,
  AppWorkspaceRecord,
  AppWorkspaceSessionRecord,
  AppWorkspaceSessionUpdateInput,
  AppWorkspaceUpsertInput,
} from './contracts/types';
import { APP_STATE_SESSION_SINGLETON_KEY } from './contracts/types';
import type { AppStateDb } from './pglite-db';
import {
  appPreferences,
  appRecentCanvases,
  appWorkspaceSession,
  appWorkspaces,
} from './contracts/schema';

export interface AppStateRepository {
  listWorkspaces(): Promise<AppWorkspaceRecord[]>;
  upsertWorkspace(input: AppWorkspaceUpsertInput): Promise<AppWorkspaceRecord>;
  removeWorkspace(workspaceId: string): Promise<void>;
  getWorkspaceSession(): Promise<AppWorkspaceSessionRecord | null>;
  setWorkspaceSession(input: AppWorkspaceSessionUpdateInput): Promise<AppWorkspaceSessionRecord>;
  listRecentCanvases(workspaceId: string): Promise<AppRecentCanvasRecord[]>;
  upsertRecentCanvas(input: AppRecentCanvasUpsertInput): Promise<AppRecentCanvasRecord>;
  clearRecentCanvases(workspaceId: string): Promise<void>;
  getPreference(key: string): Promise<AppPreferenceRecord | null>;
  setPreference(input: AppPreferenceUpsertInput): Promise<AppPreferenceRecord>;
}

export class AppStatePersistenceRepository implements AppStateRepository {
  constructor(private readonly db: AppStateDb) {}

  async listWorkspaces(): Promise<AppWorkspaceRecord[]> {
    return this.db
      .select()
      .from(appWorkspaces)
      .orderBy(
        desc(appWorkspaces.isPinned),
        desc(appWorkspaces.lastOpenedAt),
        asc(appWorkspaces.displayName),
      );
  }

  async upsertWorkspace(input: AppWorkspaceUpsertInput): Promise<AppWorkspaceRecord> {
    const inserted = await this.db
      .insert(appWorkspaces)
      .values({
        id: input.id,
        rootPath: input.rootPath,
        displayName: input.displayName,
        status: input.status,
        isPinned: input.isPinned ?? false,
        lastOpenedAt: input.lastOpenedAt ?? null,
        lastSeenAt: input.lastSeenAt ?? null,
      })
      .onConflictDoUpdate({
        target: appWorkspaces.rootPath,
        set: {
          displayName: input.displayName,
          status: input.status,
          isPinned: input.isPinned ?? false,
          lastOpenedAt: input.lastOpenedAt ?? null,
          lastSeenAt: input.lastSeenAt ?? null,
          updatedAt: new Date(),
        },
      })
      .returning();

    return requireFirstRow(inserted, 'app workspace upsert');
  }

  async removeWorkspace(workspaceId: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx
        .delete(appRecentCanvases)
        .where(eq(appRecentCanvases.workspaceId, workspaceId));

      const session = await tx
        .select()
        .from(appWorkspaceSession)
        .where(eq(appWorkspaceSession.singletonKey, APP_STATE_SESSION_SINGLETON_KEY))
        .limit(1);

      if (session[0]?.activeWorkspaceId === workspaceId) {
        await tx
          .insert(appWorkspaceSession)
          .values({
            singletonKey: APP_STATE_SESSION_SINGLETON_KEY,
            activeWorkspaceId: null,
          })
          .onConflictDoUpdate({
            target: appWorkspaceSession.singletonKey,
            set: {
              activeWorkspaceId: null,
              updatedAt: new Date(),
            },
          });
      }

      await tx
        .delete(appWorkspaces)
        .where(eq(appWorkspaces.id, workspaceId));
    });
  }

  async getWorkspaceSession(): Promise<AppWorkspaceSessionRecord | null> {
    const rows = await this.db
      .select()
      .from(appWorkspaceSession)
      .where(eq(appWorkspaceSession.singletonKey, APP_STATE_SESSION_SINGLETON_KEY))
      .limit(1);

    return rows[0] ?? null;
  }

  async setWorkspaceSession(input: AppWorkspaceSessionUpdateInput): Promise<AppWorkspaceSessionRecord> {
    const inserted = await this.db
      .insert(appWorkspaceSession)
      .values({
        singletonKey: APP_STATE_SESSION_SINGLETON_KEY,
        activeWorkspaceId: input.activeWorkspaceId ?? null,
      })
      .onConflictDoUpdate({
        target: appWorkspaceSession.singletonKey,
        set: {
          activeWorkspaceId: input.activeWorkspaceId ?? null,
          updatedAt: new Date(),
        },
      })
      .returning();

    return requireFirstRow(inserted, 'app workspace session upsert');
  }

  async listRecentCanvases(workspaceId: string): Promise<AppRecentCanvasRecord[]> {
    return this.db
      .select()
      .from(appRecentCanvases)
      .where(eq(appRecentCanvases.workspaceId, workspaceId))
      .orderBy(desc(appRecentCanvases.lastOpenedAt), asc(appRecentCanvases.canvasId));
  }

  async upsertRecentCanvas(input: AppRecentCanvasUpsertInput): Promise<AppRecentCanvasRecord> {
    const inserted = await this.db
      .insert(appRecentCanvases)
      .values({
        workspaceId: input.workspaceId,
        canvasId: input.canvasId,
        lastOpenedAt: input.lastOpenedAt ?? null,
      })
      .onConflictDoUpdate({
        target: [appRecentCanvases.workspaceId, appRecentCanvases.canvasId],
        set: {
          lastOpenedAt: input.lastOpenedAt ?? null,
          updatedAt: new Date(),
        },
      })
      .returning();

    return requireFirstRow(inserted, 'app recent canvas upsert');
  }

  async clearRecentCanvases(workspaceId: string): Promise<void> {
    await this.db
      .delete(appRecentCanvases)
      .where(eq(appRecentCanvases.workspaceId, workspaceId));
  }

  async getPreference(key: string): Promise<AppPreferenceRecord | null> {
    const rows = await this.db
      .select()
      .from(appPreferences)
      .where(eq(appPreferences.key, key))
      .limit(1);

    return rows[0] ?? null;
  }

  async setPreference(input: AppPreferenceUpsertInput): Promise<AppPreferenceRecord> {
    const inserted = await this.db
      .insert(appPreferences)
      .values({
        key: input.key,
        valueJson: normalizePreferenceValue(input.valueJson),
      })
      .onConflictDoUpdate({
        target: appPreferences.key,
        set: {
          valueJson: normalizePreferenceValue(input.valueJson),
          updatedAt: new Date(),
        },
      })
      .returning();

    return requireFirstRow(inserted, 'app preference upsert');
  }
}

function normalizePreferenceValue(value: AppPreferenceValue): AppPreferenceValue {
  return value ?? null;
}

function requireFirstRow<T>(rows: T[], operation: string): T {
  const row = rows[0];
  if (!row) {
    throw new Error(`AppStatePersistenceRepository: ${operation} returned no rows.`);
  }

  return row;
}
