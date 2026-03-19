import { expect, test } from '@playwright/test';

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
          children: [],
        },
      },
    });
  });

  await page.route('**/api/assets/file', (route) => route.abort());
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle');
});

test.skip('canvas core authoring entry: resumes last active document', async ({ page }) => {
  await expect(page).toHaveURL('/');
});

test.skip('canvas core authoring entry: creates a document into an empty canvas', async ({ page }) => {
  await expect(page).toHaveURL('/');
});
