import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { expect, test } from '@playwright/test';

const lastActiveStorageKey = 'magam:lastActiveDocumentSession';
const createFixtureRelativePath = 'test-results/canvas-core-authoring-create.graph.tsx';
const createFixtureAbsolutePath = resolve(process.cwd(), createFixtureRelativePath);
const createFixtureSource = `
export default function CanvasCoreAuthoringCreateFixture() {
  return <Canvas></Canvas>;
}
`;
let renderGraphChildren: Array<Record<string, unknown>> = [];
const files = [
  createFixtureRelativePath,
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
        name: 'test-results',
        path: 'test-results',
        type: 'directory',
        children: files
          .filter((filePath) => filePath.startsWith('test-results/'))
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
  mkdirSync(dirname(createFixtureAbsolutePath), { recursive: true });
  writeFileSync(createFixtureAbsolutePath, createFixtureSource, 'utf-8');
  renderGraphChildren = [
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
  ];

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

    const requestBody = route.request().postDataJSON() as { filePath?: string } | undefined;
    const filePath = typeof requestBody?.filePath === 'string'
      ? requestBody.filePath
      : files[0];

    route.fulfill({
      status: 200,
      contentType: 'application/json',
      json: {
        graph: {
          children: renderGraphChildren,
        },
        sourceVersion: 'test-version',
        sourceVersions: {
          [filePath]: 'test-version',
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

  test('canvas core authoring create: minimal shape set', async ({ page }) => {
    await page.evaluate(([storageKey]) => {
      window.localStorage.removeItem(storageKey);
    }, [lastActiveStorageKey]);
    renderGraphChildren = [];
    await page.reload({ waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('tab', { name: 'canvas-core-authoring-create.graph.tsx' })).toBeVisible();
    const pane = page.locator('.react-flow__pane');
    await expect(pane).toBeVisible();

    const openCreateMenu = async () => {
      await page.locator('[data-floating-toolbar-create-toggle]').click();
    };

    await openCreateMenu();
    await expect(page.getByRole('button', { name: 'Rectangle' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ellipse' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Diamond' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Text' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Markdown' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Line' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sticky' })).toBeVisible();

    await page.getByRole('button', { name: 'Rectangle' }).click();
    await expect(page.locator('[data-floating-toolbar-create-toggle]')).toHaveAttribute('title', 'Create Mode: Rectangle');

    await openCreateMenu();
    await page.getByRole('button', { name: 'Ellipse' }).click();
    await expect(page.locator('[data-floating-toolbar-create-toggle]')).toHaveAttribute('title', 'Create Mode: Ellipse');

    await openCreateMenu();
    await page.getByRole('button', { name: 'Diamond' }).click();
    await expect(page.locator('[data-floating-toolbar-create-toggle]')).toHaveAttribute('title', 'Create Mode: Diamond');

    await openCreateMenu();
    await page.getByRole('button', { name: 'Text' }).click();
    await expect(page.locator('[data-floating-toolbar-create-toggle]')).toHaveAttribute('title', 'Create Mode: Text');

    await openCreateMenu();
    await page.getByRole('button', { name: 'Markdown' }).click();
    await expect(page.locator('[data-floating-toolbar-create-toggle]')).toHaveAttribute('title', 'Create Mode: Markdown');

    await openCreateMenu();
    await page.getByRole('button', { name: 'Sticky' }).click();
    await expect(page.locator('[data-floating-toolbar-create-toggle]')).toHaveAttribute('title', 'Create Mode: Sticky');

    await openCreateMenu();
    await page.getByRole('button', { name: 'Line' }).click();
    await expect(page.locator('[data-floating-toolbar-create-toggle]')).toHaveAttribute('title', 'Create Mode: Line');
    await pane.click({ position: { x: 220, y: 420 } });
    await expect(page.locator('[data-floating-toolbar-create-toggle]')).toHaveAttribute('title', 'Create Mode: Line');
    await expect(page.getByText('EDIT_REJECTED')).toHaveCount(0);
  });
});
