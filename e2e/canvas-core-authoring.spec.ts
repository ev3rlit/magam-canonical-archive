import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { expect, test } from '@playwright/test';

const lastActiveStorageKey = 'magam:lastActiveDocumentSession';
const createFixtureRelativePath = 'test-results/canvas-core-authoring-create.graph.tsx';
const createFixtureAbsolutePath = resolve(process.cwd(), createFixtureRelativePath);
type RenderFixtureNode = {
  type: string;
  props?: Record<string, unknown>;
  children?: RenderFixtureNode[];
};

let renderGraphChildren: RenderFixtureNode[] = [];
let renderGraphSourceVersion = 'sha256:unknown';
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

function serializeExpression(value: unknown): string {
  if (value === undefined) {
    throw new Error('Cannot serialize undefined expression');
  }
  return JSON.stringify(value);
}

function serializeProps(
  props: Record<string, unknown> | undefined,
  options?: { omitKeys?: string[] },
): string {
  if (!props) {
    return '';
  }

  const omitKeys = new Set(options?.omitKeys ?? []);
  return Object.entries(props)
    .filter(([, value]) => value !== undefined)
    .filter(([key]) => !omitKeys.has(key))
    .map(([key, value]) => ` ${key}={${serializeExpression(value)}}`)
    .join('');
}

function serializeCanvasNode(node: RenderFixtureNode, indent: string): string {
  const props = node.props ?? {};
  const textChild = typeof props.text === 'string' ? `{${JSON.stringify(props.text)}}` : null;
  const markdownContent = typeof props.content === 'string' ? `{${JSON.stringify(props.content)}}` : null;
  const childrenMarkup = (node.children ?? []).map((child) => serializeCanvasNode(child, `${indent}  `));

  if (node.type === 'graph-shape') {
    if (childrenMarkup.length === 0) {
      return `${indent}<Shape${serializeProps(props, { omitKeys: ['text'] })}>${textChild ?? ''}</Shape>`;
    }

    return [
      `${indent}<Shape${serializeProps(props, { omitKeys: ['text'] })}>`,
      ...(textChild ? [`${indent}  ${textChild}`] : []),
      ...childrenMarkup,
      `${indent}</Shape>`,
    ].join('\n');
  }
  if (node.type === 'graph-text') {
    return `${indent}<Text${serializeProps(props, { omitKeys: ['text'] })}>${textChild ?? ''}</Text>`;
  }
  if (node.type === 'graph-sticker') {
    return `${indent}<Sticker${serializeProps(props, { omitKeys: ['text'] })}>${textChild ?? ''}</Sticker>`;
  }
  if (node.type === 'graph-sticky') {
    return `${indent}<Sticky${serializeProps(props, { omitKeys: ['text'] })}>${textChild ?? ''}</Sticky>`;
  }
  if (node.type === 'graph-markdown') {
    return `${indent}<Markdown>${markdownContent ?? textChild ?? ''}</Markdown>`;
  }
  if (node.type === 'graph-node') {
    if (childrenMarkup.length === 0) {
      return `${indent}<Node${serializeProps(props)} />`;
    }

    return [
      `${indent}<Node${serializeProps(props)}>`,
      ...childrenMarkup,
      `${indent}</Node>`,
    ].join('\n');
  }

  throw new Error(`Unsupported fixture node type: ${node.type}`);
}

function buildCreateFixtureSource(children: RenderFixtureNode[]): string {
  const lines = children.map((child) => serializeCanvasNode(child, '      '));
  return [
    "import { Canvas, Markdown, Node, Shape, Sticker, Sticky, Text } from '@magam/core';",
    '',
    'export default function CanvasCoreAuthoringCreateFixture() {',
    '  return (',
    '    <Canvas>',
    ...lines,
    '    </Canvas>',
    '  );',
    '}',
    '',
  ].join('\n');
}

function setCreateFixtureChildren(children: RenderFixtureNode[]): void {
  renderGraphChildren = children;
  const source = buildCreateFixtureSource(children);
  mkdirSync(dirname(createFixtureAbsolutePath), { recursive: true });
  writeFileSync(createFixtureAbsolutePath, source, 'utf-8');
  renderGraphSourceVersion = `sha256:${createHash('sha256').update(source).digest('hex')}`;
}

test.beforeEach(async ({ page }) => {
  setCreateFixtureChildren([
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
  ]);

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
        sourceVersion: renderGraphSourceVersion,
        sourceVersions: {
          [filePath]: renderGraphSourceVersion,
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

    const selectionShell = page.getByTestId('graph-canvas-selection-shell');
    await expect(selectionShell).toBeVisible();
    await expect(selectionShell).toHaveCSS('border-radius', '0px');
    await expect(page.getByTestId('graph-canvas-resize-handle')).toBeVisible();
    await expect(page.getByTestId('graph-canvas-rotate-handle')).toBeVisible();
  });

  test('canvas core authoring create: minimal shape set', async ({ page }) => {
    await page.evaluate(([storageKey]) => {
      window.localStorage.removeItem(storageKey);
    }, [lastActiveStorageKey]);
    setCreateFixtureChildren([]);
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

  test('canvas core authoring actions: floating menu context menu shortcuts', async ({ page, browserName }) => {
    void browserName;
    await page.evaluate(([storageKey]) => {
      window.localStorage.removeItem(storageKey);
    }, [lastActiveStorageKey]);
    setCreateFixtureChildren([
      {
        type: 'graph-shape',
        props: {
          id: 'shape-actions',
          x: 120,
          y: 120,
          type: 'rectangle',
          text: 'Shape actions',
          size: { width: 180, height: 120 },
        },
        children: [],
      },
      {
        type: 'graph-text',
        props: {
          id: 'text-actions',
          x: 380,
          y: 160,
          text: 'Editable text',
        },
        children: [],
      },
    ]);
    await page.reload({ waitUntil: 'domcontentloaded' });

    const shapeNode = page.locator('.react-flow__node[data-id="shape-actions"]');
    const textNode = page.locator('.react-flow__node[data-id="text-actions"]');
    await expect(shapeNode).toBeVisible();
    await expect(textNode).toBeVisible();

    await shapeNode.click();
    await expect(page.locator('[data-selection-floating-control="font-family"]')).toBeVisible();
    await expect(page.locator('[data-selection-floating-control="font-size"]')).toBeVisible();
    await expect(page.locator('[data-selection-floating-control="bold"]')).toBeVisible();
    await expect(page.locator('[data-selection-floating-control="color"]')).toBeVisible();
    await expect(page.locator('[data-selection-floating-control="more"]')).toHaveCount(0);
    await expect(page.locator('[data-selection-floating-control="object-type"]')).toHaveCount(0);

    await shapeNode.click({ button: 'right' });
    await expect(page.getByText('ID 변경')).toBeVisible();
    await expect(page.getByText('복제')).toBeVisible();
    await expect(page.getByText('삭제')).toBeVisible();
    await expect(page.getByText('잠금 토글')).toBeVisible();
    await page.keyboard.press('Escape');

    await textNode.dblclick();
    await expect(page.locator('textarea')).toBeVisible();
    await expect(page.locator('[data-selection-floating-control]')).toHaveCount(0);

    await page.keyboard.press('Meta+=');
    await expect(page.locator('textarea')).toBeVisible();
    await expect(page.getByText('Zoom:')).toBeVisible();

    await page.keyboard.press('Meta+D');
    await expect(page.getByText('EDIT_REJECTED')).toHaveCount(0);

    await page.keyboard.press('Escape');
    await expect(page.locator('textarea')).toHaveCount(0);

    await page.keyboard.press('Meta+A');
    await expect(page.locator('.react-flow__node.selected')).toHaveCount(2);
  });

  test('canvas core authoring structure: group ungroup z-order', async ({ page, browserName }) => {
    void browserName;
    await page.evaluate(([storageKey]) => {
      window.localStorage.removeItem(storageKey);
    }, [lastActiveStorageKey]);
    setCreateFixtureChildren([
      {
        type: 'graph-shape',
        props: {
          id: 'shape-a',
          x: 120,
          y: 140,
          type: 'rectangle',
          text: 'A',
          size: { width: 140, height: 100 },
        },
        children: [],
      },
      {
        type: 'graph-shape',
        props: {
          id: 'shape-b',
          x: 320,
          y: 140,
          type: 'rectangle',
          text: 'B',
          size: { width: 140, height: 100 },
        },
        children: [],
      },
      {
        type: 'graph-shape',
        props: {
          id: 'shape-c',
          x: 520,
          y: 140,
          type: 'rectangle',
          text: 'C',
          size: { width: 140, height: 100 },
        },
        children: [],
      },
    ]);
    await page.reload({ waitUntil: 'domcontentloaded' });

    const shapeA = page.locator('.react-flow__node[data-id="shape-a"]');
    const shapeB = page.locator('.react-flow__node[data-id="shape-b"]');
    const shapeC = page.locator('.react-flow__node[data-id="shape-c"]');
    await expect(shapeA).toBeVisible();
    await expect(shapeB).toBeVisible();
    await expect(shapeC).toBeVisible();

    await page.keyboard.press('Meta+A');
    await expect(page.locator('.react-flow__node.selected')).toHaveCount(3);
    await page.keyboard.press('Meta+G');
    await expect(page.getByText('EDIT_REJECTED')).toHaveCount(0);
    await expect(page.locator('.react-flow__node.selected')).toHaveCount(3);

    await shapeA.click({ button: 'right', force: true });
    await expect(page.getByText('그룹 안으로 들어가기')).toBeVisible();
    await expect(page.getByText('그룹 해제')).toBeVisible();
    await expect(page.getByText('맨 앞으로')).toBeVisible();
    await expect(page.getByText('맨 뒤로')).toBeVisible();
    await page.getByText('그룹 안으로 들어가기').click();

    await expect(page.locator('.react-flow__node.selected')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(page.locator('.react-flow__node.selected')).toHaveCount(3);

    await shapeA.click({ button: 'right', force: true });
    await expect(page.getByText('그룹 해제')).toBeVisible();
    await expect(page.getByText('맨 앞으로')).toBeVisible();
    await expect(page.getByText('맨 뒤로')).toBeVisible();
  });

  test('canvas core authoring body: markdown first editing', async ({ page }) => {
    await page.evaluate(([storageKey]) => {
      window.localStorage.removeItem(storageKey);
    }, [lastActiveStorageKey]);
    setCreateFixtureChildren([
      {
        type: 'graph-text',
        props: {
          id: 'text-body',
          x: 120,
          y: 120,
          text: 'Body text',
        },
        children: [],
      },
      {
        type: 'graph-node',
        props: {
          id: 'markdown-body',
          x: 360,
          y: 120,
        },
        children: [
          {
            type: 'graph-markdown',
            props: {
              content: '# Markdown body',
            },
            children: [],
          },
        ],
      },
      {
        type: 'graph-shape',
        props: {
          id: 'shape-body',
          x: 560,
          y: 120,
          type: 'rectangle',
          size: { width: 180, height: 120 },
          text: 'Shape fallback',
        },
        children: [
          {
            type: 'graph-markdown',
            props: {
              content: '### Shape body',
            },
            children: [],
          },
        ],
      },
      {
        type: 'graph-sticky',
        props: {
          id: 'sticky-body',
          x: 820,
          y: 120,
          text: 'Sticky body',
        },
        children: [],
      },
    ]);
    await page.reload({ waitUntil: 'domcontentloaded' });

    const pane = page.locator('.react-flow__pane');
    const textNode = page.locator('.react-flow__node[data-id="text-body"]');
    const markdownNode = page.locator('.react-flow__node[data-id="markdown-body"]');
    const shapeNode = page.locator('.react-flow__node[data-id="shape-body"]');
    const stickyNode = page.locator('.react-flow__node[data-id="sticky-body"]');

    await expect(textNode).toBeVisible();
    await expect(markdownNode).toBeVisible();
    await expect(shapeNode).toBeVisible();
    await expect(stickyNode).toBeVisible();

    await textNode.dblclick();
    await expect(page.locator('textarea')).toBeVisible();
    await expect(page.getByTestId('graph-canvas-selection-shell')).toHaveCount(0);
    await expect(page.locator('[data-selection-floating-control]')).toHaveCount(0);

    await page.keyboard.press('Meta+A');
    await expect(page.locator('.react-flow__node.selected')).toHaveCount(1);

    await pane.click({ position: { x: 40, y: 40 } });
    await expect(page.locator('textarea')).toHaveCount(0);
    await expect(page.locator('.react-flow__node.selected')).toHaveCount(1);

    await markdownNode.click();
    await page.keyboard.press('Enter');
    await expect(page.locator('textarea')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('textarea')).toHaveCount(0);

    await shapeNode.click();
    await page.keyboard.press('Enter');
    await expect(page.locator('textarea')).toBeVisible();
    await page.locator('textarea').fill('### Updated shape body');
    await pane.click({ position: { x: 40, y: 40 } });
    await expect(page.locator('textarea')).toHaveCount(0);
    await expect(page.getByText('EDIT_REJECTED')).toHaveCount(0);
    await shapeNode.dblclick();
    await expect(page.locator('textarea')).toHaveValue('### Updated shape body');
    await page.keyboard.press('Escape');

    await page.setViewportSize({ width: 390, height: 844 });
    await shapeNode.click();
    const shapeEditButton = shapeNode.getByRole('button', { name: 'Edit content' });
    await expect(shapeEditButton).toBeVisible();
    await shapeEditButton.click();
    await expect(page.locator('textarea')).toBeVisible();
    await page.keyboard.press('Escape');

    await stickyNode.click();
    const stickyEditButton = stickyNode.getByRole('button', { name: 'Edit content' });
    await expect(stickyEditButton).toBeVisible();
    await stickyEditButton.click();
    await expect(page.locator('textarea')).toBeVisible();
  });
});
