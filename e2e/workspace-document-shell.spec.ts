import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';

const WORKSPACE_REGISTRY_STORAGE_KEY = 'magam:workspaceRegistry:v1';
const ACTIVE_WORKSPACE_STORAGE_KEY = 'magam:activeWorkspaceId:v1';
const LAST_ACTIVE_DOCUMENTS_STORAGE_KEY = 'magam:lastActiveDocuments:v1';

type WorkspaceHealthState = 'ok' | 'missing' | 'not-directory' | 'unreadable';

type WorkspaceFixture = {
  rootPath: string;
  workspaceName: string;
  health: WorkspaceHealthState;
  documents: string[];
};

function createSourceVersion(seed: string): string {
  let hash = 0;
  for (const char of seed) {
    hash = ((hash << 5) - hash) + char.charCodeAt(0);
    hash |= 0;
  }
  return `sha256:${Math.abs(hash).toString(16).padStart(8, '0')}`;
}

function toDocumentSummary(filePath: string, index: number) {
  return {
    filePath,
    size: 128 + index,
    modifiedAt: 1_710_000_000_000 + (index * 1000),
  };
}

function buildProbe(workspace: WorkspaceFixture) {
  const isAvailable = workspace.health === 'ok';
  const documents = isAvailable
    ? workspace.documents.map(toDocumentSummary)
    : [];

  return {
    rootPath: workspace.rootPath,
    root: workspace.rootPath,
    workspaceName: workspace.workspaceName,
    name: workspace.workspaceName,
    health: {
      state: workspace.health,
      message: isAvailable
        ? undefined
        : 'Workspace root does not exist',
      documentCount: documents.length,
    },
    documentCount: documents.length,
    documents,
    lastModifiedAt: documents.length > 0
      ? Math.max(...documents.map((document) => document.modifiedAt))
      : null,
  };
}

function buildFileTree(workspace: WorkspaceFixture) {
  const rootName = path.basename(workspace.rootPath);
  const tree = {
    name: rootName,
    path: '',
    type: 'directory',
    children: [] as Array<Record<string, unknown>>,
  };
  const directoryMap = new Map<string, { name: string; path: string; type: 'directory'; children: Array<Record<string, unknown>> }>();
  directoryMap.set('', tree);

  for (const filePath of workspace.documents) {
    const segments = filePath.split('/').filter(Boolean);
    let currentPath = '';
    for (let index = 0; index < segments.length; index += 1) {
      const segment = segments[index];
      const nextPath = currentPath ? `${currentPath}/${segment}` : segment;
      const parent = directoryMap.get(currentPath) ?? tree;
      const isLeaf = index === segments.length - 1;

      if (isLeaf) {
        if (!parent.children.some((child) => child.path === nextPath)) {
          parent.children.push({
            name: segment,
            path: nextPath,
            type: 'file',
          });
        }
        continue;
      }

      if (!directoryMap.has(nextPath)) {
        const directory = {
          name: segment,
          path: nextPath,
          type: 'directory' as const,
          children: [] as Array<Record<string, unknown>>,
        };
        directoryMap.set(nextPath, directory);
        parent.children.push(directory);
      }

      currentPath = nextPath;
    }
  }

  return { tree };
}

async function installWorkspaceShellRoutes(
  page: Page,
  input: {
    workspaces: WorkspaceFixture[];
    promptResponses?: string[];
    initialStorage?: Record<string, unknown>;
  },
) {
  const workspaces = new Map(input.workspaces.map((workspace) => [workspace.rootPath, workspace]));
  const promptResponses = [...(input.promptResponses ?? [])];

  await page.addInitScript((args) => {
    window.localStorage.clear();
    Object.entries(args.initialStorage).forEach(([key, value]) => {
      window.localStorage.setItem(key, JSON.stringify(value));
    });
    const queue = [...args.promptResponses];
    window.prompt = () => queue.shift() ?? null;
    window.confirm = () => true;
  }, {
    promptResponses,
    initialStorage: input.initialStorage ?? {},
  });

  await page.route('**/api/workspaces**', async (route) => {
    const url = new URL(route.request().url());
    const rootPath = url.searchParams.get('rootPath') ?? url.searchParams.get('root');

    if (route.request().method() === 'GET') {
      const workspace = rootPath ? workspaces.get(rootPath) : Array.from(workspaces.values())[0];
      if (!workspace) {
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Workspace not found' }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildProbe(workspace)),
      });
      return;
    }

    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON() as { rootPath?: string; action?: string };
      const requestedRootPath = typeof body.rootPath === 'string' ? body.rootPath : null;
      if (!requestedRootPath) {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'rootPath is required' }),
        });
        return;
      }

      const action = body.action;
      if (action === 'ensure') {
        const existing = workspaces.get(requestedRootPath);
        const workspace = existing ?? {
          rootPath: requestedRootPath,
          workspaceName: path.basename(requestedRootPath),
          health: 'ok' as const,
          documents: [],
        };
        workspaces.set(requestedRootPath, workspace);
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(buildProbe(workspace)),
        });
        return;
      }

      const workspace = workspaces.get(requestedRootPath);
      if (!workspace) {
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Workspace not found' }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: action === 'reveal' ? 'WS_200_REVEALED' : 'WS_200_OPENED',
          rootPath: workspace.rootPath,
          root: workspace.rootPath,
          workspaceName: workspace.workspaceName,
          name: workspace.workspaceName,
          targetPath: workspace.rootPath,
          requestedAction: action,
          mode: action,
          launched: true,
        }),
      });
      return;
    }

    await route.continue();
  });

  await page.route('**/api/documents**', async (route) => {
    const url = new URL(route.request().url());
    const rootPath = url.searchParams.get('rootPath') ?? url.searchParams.get('root');

    if (route.request().method() === 'GET') {
      const workspace = rootPath ? workspaces.get(rootPath) : null;
      if (!workspace) {
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Workspace not found' }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildProbe(workspace)),
      });
      return;
    }

    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON() as { rootPath?: string; filePath?: string };
      const requestedRootPath = typeof body.rootPath === 'string' ? body.rootPath : null;
      if (!requestedRootPath) {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'rootPath is required' }),
        });
        return;
      }

      const workspace = workspaces.get(requestedRootPath);
      if (!workspace) {
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Workspace not found' }),
        });
        return;
      }

      const filePath = typeof body.filePath === 'string' && body.filePath.length > 0
        ? body.filePath
        : `docs/untitled-${workspace.documents.length + 1}.graph.tsx`;
      if (!workspace.documents.includes(filePath)) {
        workspace.documents.unshift(filePath);
      }

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          filePath,
          sourceVersion: createSourceVersion(`${requestedRootPath}:${filePath}`),
        }),
      });
      return;
    }

    await route.continue();
  });

  await page.route('**/api/file-tree**', async (route) => {
    const url = new URL(route.request().url());
    const rootPath = url.searchParams.get('rootPath') ?? url.searchParams.get('root');
    const workspace = rootPath ? workspaces.get(rootPath) : null;

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(workspace ? buildFileTree(workspace) : { tree: null }),
    });
  });

  await page.route('**/api/files**', async (route) => {
    const allFiles = Array.from(workspaces.values()).flatMap((workspace) => workspace.documents);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ files: allFiles }),
    });
  });

  await page.route('**/api/render', async (route) => {
    const body = route.request().postDataJSON() as { filePath?: string };
    const filePath = typeof body.filePath === 'string' ? body.filePath : 'docs/untitled-1.graph.tsx';
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        graph: {
          children: [],
        },
        sourceVersion: createSourceVersion(filePath),
        sourceVersions: {
          [filePath]: createSourceVersion(filePath),
        },
      }),
    });
  });
}

test.describe('workspace document shell', () => {
  test('supports first-run workspace registration and scope switching', async ({ page }) => {
    const sidebar = page.locator('aside');

    await installWorkspaceShellRoutes(page, {
      workspaces: [
        {
          rootPath: '/tmp/workspace-b',
          workspaceName: 'workspace-b',
          health: 'ok',
          documents: ['docs/beta.graph.tsx'],
        },
      ],
      promptResponses: ['/tmp/workspace-a', '/tmp/workspace-b'],
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');

    await expect(sidebar.getByText('등록된 workspace가 없습니다.')).toBeVisible();
    await sidebar.getByRole('button', { name: 'New Workspace' }).click();

    await expect(sidebar.getByText('/tmp/workspace-a')).toBeVisible();
    await expect(sidebar.getByText('이 workspace에는 아직 문서가 없습니다.')).toBeVisible();

    await sidebar.getByRole('button', { name: 'Add Existing' }).click();
    await expect(sidebar.getByText('/tmp/workspace-b')).toBeVisible();
    await expect(
      sidebar.getByRole('button').filter({ hasText: 'beta.graph.tsx' }).first(),
    ).toBeVisible();

    await sidebar.locator('select').first().selectOption({ label: 'workspace-a · Available' });
    await expect(sidebar.getByText('/tmp/workspace-a')).toBeVisible();
    await expect(sidebar.getByText('이 workspace에는 아직 문서가 없습니다.')).toBeVisible();
  });

  test('creates a new document and keeps legacy TSX browsing in compatibility only', async ({ page }) => {
    const sidebar = page.locator('aside');

    await installWorkspaceShellRoutes(page, {
      workspaces: [],
      promptResponses: ['/tmp/workspace-c'],
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');

    await sidebar.getByRole('button', { name: 'New Workspace' }).click();
    await expect(sidebar.getByText('/tmp/workspace-c')).toBeVisible();

    await sidebar.getByRole('button', { name: 'New Document' }).click();
    await expect(page.getByRole('tab', { name: 'untitled-1.graph.tsx' })).toBeVisible();
    await expect(
      sidebar.getByRole('button').filter({ hasText: 'untitled-1.graph.tsx' }).first(),
    ).toBeVisible();
    await expect(sidebar.getByText('Compatibility')).toBeVisible();
    await expect(sidebar.getByText('Document list가 primary navigation입니다.')).toBeVisible();
  });

  test('shows unavailable state and reconnects without silent fallback', async ({ page }) => {
    const sidebar = page.locator('aside');

    await installWorkspaceShellRoutes(page, {
      workspaces: [
        {
          rootPath: '/tmp/missing-workspace',
          workspaceName: 'missing-workspace',
          health: 'missing',
          documents: [],
        },
        {
          rootPath: '/tmp/reconnected-workspace',
          workspaceName: 'reconnected-workspace',
          health: 'ok',
          documents: [],
        },
      ],
      promptResponses: ['/tmp/reconnected-workspace'],
      initialStorage: {
        [WORKSPACE_REGISTRY_STORAGE_KEY]: [
          {
            id: 'workspace-missing',
            name: 'missing-workspace',
            rootPath: '/tmp/missing-workspace',
            status: 'ok',
            documentCount: 0,
            lastModifiedAt: null,
            lastOpenedAt: 1,
          },
        ],
        [ACTIVE_WORKSPACE_STORAGE_KEY]: 'workspace-missing',
        [LAST_ACTIVE_DOCUMENTS_STORAGE_KEY]: {},
      },
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');

    await expect(sidebar.getByText('Workspace is unavailable')).toBeVisible();
    await expect(sidebar.getByRole('button', { name: 'Reconnect' })).toBeVisible();
    await expect(sidebar.getByRole('button', { name: 'Remove' })).toBeVisible();

    await sidebar.getByRole('button', { name: 'Reconnect' }).click();
    await expect(sidebar.getByText('/tmp/reconnected-workspace')).toBeVisible();
    await expect(sidebar.getByText('Workspace is unavailable')).not.toBeVisible();
  });
});
