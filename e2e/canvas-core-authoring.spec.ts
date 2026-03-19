import { expect, test } from '@playwright/test';

const lastActiveStorageKey = 'magam:lastActiveDocumentSession';
const files = [
  'docs/resume.graph.tsx',
  'docs/empty-canvas.graph.tsx',
  'notes/reference.graph.tsx',
];

const treeData = {
  tree: {
    name: 'workspace',
    path: '/',
    type: 'directory',
    children: [
      {
        name: 'docs',
        path: 'docs',
        type: 'directory',
        children: files
          .filter((filePath) => filePath.startsWith('docs/'))
          .map((filePath) => ({
            name: filePath.split('/').at(-1) ?? filePath,
            path: filePath,
            type: 'file',
          })),
      },
      {
        name: 'notes',
        path: 'notes',
        type: 'directory',
        children: files
          .filter((filePath) => filePath.startsWith('notes/'))
          .map((filePath) => ({
            name: filePath.split('/').at(-1) ?? filePath,
            path: filePath,
            type: 'file',
          })),
      },
    ],
  },
};

test.beforeEach(async ({ page }) => {
  await page.route('**/api/files', (route) => {
    if (route.request().method() !== 'GET') {
      route.continue();
      return;
    }

    route.fulfill({
      status: 200,
      contentType: 'application/json',
      json: { files },
    });
  });

  await page.route('**/api/file-tree', (route) => {
    if (route.request().method() !== 'GET') {
      route.continue();
      return;
    }

    route.fulfill({
      status: 200,
      contentType: 'application/json',
      json: treeData,
    });
  });

  await page.route('**/api/render', (route) => {
    if (route.request().method() !== 'POST') {
      route.continue();
      return;
    }

    route.fulfill({
      status: 200,
      contentType: 'application/json',
      json: {
        graph: {
          children: [
            {
              type: 'graph-sticker',
              props: {
                id: 'viewport-sticker',
                x: 120,
                y: 96,
                width: 180,
                height: 120,
                rotation: 0,
                text: 'Viewport baseline',
              },
              children: [],
            },
          ],
        },
      },
    });
  });

  await page.route('**/api/assets/file', (route) => route.abort());
  await page.goto('/', { waitUntil: 'domcontentloaded' });
});

test.describe('canvas core authoring entry', () => {
  test('canvas core authoring entry: resumes last active document', async ({ page }) => {
    await page.addInitScript(([storageKey, value]) => {
      window.localStorage.setItem(storageKey, JSON.stringify(value));
    }, [
      lastActiveStorageKey,
      {
        workspaceKey: `workspace:${files.join('|')}`,
        documentPath: 'docs/resume.graph.tsx',
        updatedAt: Date.now(),
      },
    ]);

    await page.reload({ waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('tab', { name: 'resume.graph.tsx' })).toBeVisible();
    await expect(page.getByText('resume.graph.tsx')).toBeVisible();
  });

  test('canvas core authoring entry: creates a document into an empty canvas', async ({ page }) => {
    await page.getByRole('button', { name: 'New document' }).click();

    await expect(page.getByRole('tab', { name: 'untitled-1.graph.tsx' })).toBeVisible();
    await expect(page.getByText('untitled-1.graph.tsx')).toBeVisible();
  });

  test('canvas core authoring viewport: pan zoom select drag resize rotate', async ({ page }) => {
    await expect(page.locator('.react-flow')).toBeVisible();
    await expect(page.getByRole('tab')).toHaveCount(1);

    const stickerNode = page.locator('.react-flow__node[data-id="viewport-sticker"]');
    await expect(stickerNode).toBeVisible();
    await stickerNode.click();

    await expect(page.getByTestId('graph-canvas-selection-shell')).toBeVisible();
    await expect(page.getByTestId('graph-canvas-resize-handle')).toBeVisible();
    await expect(page.getByTestId('graph-canvas-rotate-handle')).toBeVisible();
  });
});
