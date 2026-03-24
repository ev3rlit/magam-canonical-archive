import { afterEach, describe, expect, it, mock } from 'bun:test';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { basename, dirname, join } from 'path';
import { tmpdir } from 'os';
import { createHash } from 'crypto';
import { createPaneCreateIntentEnvelope, createRenameIntentEnvelope } from '@/features/editing/actionRoutingBridge/__fixtures__/intentEnvelopes';
import { routeIntent } from '@/features/editing/actionRoutingBridge/routeIntent';
import { makeActionRoutingContext, makeCanonicalNode } from '@/features/editing/actionRoutingBridge/testUtils';
import type { MutationDispatchDescriptor } from '@/features/editing/actionRoutingBridge/types';
import { methods } from './methods';

const tempDirs: string[] = [];
const originalMagamTargetDir = process.env.MAGAM_TARGET_DIR;

afterEach(async () => {
  await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
  tempDirs.length = 0;
  if (originalMagamTargetDir === undefined) {
    delete process.env.MAGAM_TARGET_DIR;
  } else {
    process.env.MAGAM_TARGET_DIR = originalMagamTargetDir;
  }
});

async function makeTempTsx(content: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'magam-methods-'));
  tempDirs.push(dir);
  const filePath = join(dir, 'sample.tsx');
  await writeFile(filePath, content, 'utf-8');
  return filePath;
}

function sha(content: string): string {
  return `sha256:${createHash('sha256').update(content).digest('hex')}`;
}

describe('RPC editing methods', () => {
  it('node.move: 성공 시 저장 + notify + newVersion 반환', async () => {
    const filePath = await makeTempTsx(`export default function Sample(){ return <Node id="n1" x={1} y={2} />; }`);
    const original = await readFile(filePath, 'utf-8');
    const notify = mock(() => { });

    const result = await methods['node.move']({
      filePath,
      nodeId: 'n1',
      x: 100,
      y: 200,
      baseVersion: sha(original),
      originId: 'client-1',
      commandId: 'cmd-1',
    }, { ws: {}, subscriptions: new Set(), notifyFileChanged: notify }) as { success: boolean; newVersion: string };

    expect(result.success).toBe(true);
    expect(result.newVersion.startsWith('sha256:')).toBe(true);
    expect(notify).toHaveBeenCalledTimes(1);

    const patched = await readFile(filePath, 'utf-8');
    expect(patched.includes('x={100}')).toBe(true);
    expect(patched.includes('y={200}')).toBe(true);
  });

  it('node.move: relative filePath는 MAGAM_TARGET_DIR 기준으로 해석한다', async () => {
    const filePath = await makeTempTsx(`export default function Sample(){ return <Node id="n1" x={1} y={2} />; }`);
    const original = await readFile(filePath, 'utf-8');
    process.env.MAGAM_TARGET_DIR = dirname(filePath);
    const relativePath = basename(filePath);
    const notify = mock((_payload: { filePath: string }) => { });

    const result = await methods['node.move']({
      filePath: relativePath,
      nodeId: 'n1',
      x: 77,
      y: 88,
      baseVersion: sha(original),
      originId: 'client-1',
      commandId: 'cmd-relative-1',
    }, { ws: {}, subscriptions: new Set(), notifyFileChanged: notify }) as { success: boolean; newVersion: string };

    expect(result.success).toBe(true);
    const patched = await readFile(filePath, 'utf-8');
    expect(patched.includes('x={77}')).toBe(true);
    expect(patched.includes('y={88}')).toBe(true);
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify.mock.calls[0]?.[0].filePath).toBe(relativePath);
  });

  it('node.update: baseVersion 불일치면 VERSION_CONFLICT', async () => {
    const filePath = await makeTempTsx(`export default function Sample(){ return <Node id="n1" x={1} y={2} />; }`);

    await expect(methods['node.update']({
      filePath,
      nodeId: 'n1',
      props: { x: 99 },
      baseVersion: 'sha256:stale',
      originId: 'client-1',
      commandId: 'cmd-1',
    }, { ws: {}, subscriptions: new Set() })).rejects.toMatchObject({ code: 40901, message: 'VERSION_CONFLICT' });
  });

  it('node.move: 전역 id 충돌이 있으면 ID_COLLISION으로 거부한다', async () => {
    const filePath = await makeTempTsx(`
      export default function Sample(){ return <Canvas><Node id="dup" x={1} y={2} /><Node id="dup" x={3} y={4} /></Canvas>; }
    `);
    const original = await readFile(filePath, 'utf-8');

    await expect(methods['node.move']({
      filePath,
      nodeId: 'dup',
      x: 111,
      y: 222,
      baseVersion: sha(original),
      originId: 'client-1',
      commandId: 'cmd-collision-1',
    }, { ws: {}, subscriptions: new Set() })).rejects.toMatchObject({
      code: 40903,
      message: 'ID_COLLISION',
      data: { collisionIds: ['dup'] },
    });
  });

  it('node.create: 새 노드를 파일에 삽입한다', async () => {
    const filePath = await makeTempTsx(`export default function Sample(){ return <Canvas><Node id="root" /></Canvas>; }`);
    const original = await readFile(filePath, 'utf-8');

    const result = await methods['node.create']({
      filePath,
      node: { id: 'child', type: 'text', props: { from: 'root', content: 'new' } },
      baseVersion: sha(original),
      originId: 'client-1',
      commandId: 'cmd-2',
    }, { ws: {}, subscriptions: new Set() }) as { success: boolean };

    expect(result.success).toBe(true);
    const patched = await readFile(filePath, 'utf-8');
    expect(patched.includes('id={"child"}')).toBe(true);
  });

  it('node.create: freshly materialized blank graph document works through the normal relative file contract', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'magam-methods-blank-'));
    tempDirs.push(dir);
    const filePath = join(dir, 'untitled-1.graph.tsx');
    await writeFile(filePath, [
      "import { Canvas } from '@magam/core';",
      '',
      'export default function UntitledDocument() {',
      '  return <Canvas></Canvas>;',
      '}',
      '',
    ].join('\n'), 'utf-8');
    const original = await readFile(filePath, 'utf-8');
    process.env.MAGAM_TARGET_DIR = dir;

    const result = await methods['node.create']({
      filePath: 'untitled-1.graph.tsx',
      node: {
        id: 'shape-1',
        type: 'rectangle',
        props: { size: { width: 180, height: 120 } },
        placement: { mode: 'canvas-absolute', x: 120, y: 160 },
      },
      baseVersion: sha(original),
      originId: 'client-1',
      commandId: 'cmd-new-doc-first-create',
    }, { ws: {}, subscriptions: new Set() }) as { success: boolean };

    expect(result.success).toBe(true);
    const patched = await readFile(filePath, 'utf-8');
    expect(patched.includes('id={"shape-1"}')).toBe(true);
    expect(patched.includes('x={120}')).toBe(true);
    expect(patched.includes('y={160}')).toBe(true);
  });

  it('node.create: compatibility documents directory paths still mutate through the relative contract', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'magam-methods-compat-'));
    tempDirs.push(dir);
    const documentsDir = join(dir, 'documents');
    await mkdir(documentsDir, { recursive: true });
    const filePath = join(documentsDir, 'doc-1.graph.tsx');
    await writeFile(filePath, [
      "import { Canvas } from '@magam/core';",
      '',
      'export default function UntitledDocument() {',
      '  return <Canvas></Canvas>;',
      '}',
      '',
    ].join('\n'), 'utf-8');
    const original = await readFile(filePath, 'utf-8');
    process.env.MAGAM_TARGET_DIR = dir;

    const result = await methods['node.create']({
      filePath: 'documents/doc-1.graph.tsx',
      node: {
        id: 'shape-compat-1',
        type: 'rectangle',
        props: { size: { width: 160, height: 100 } },
        placement: { mode: 'canvas-absolute', x: 48, y: 96 },
      },
      baseVersion: sha(original),
      originId: 'client-1',
      commandId: 'cmd-compat-doc-create',
    }, { ws: {}, subscriptions: new Set() }) as { success: boolean };

    expect(result.success).toBe(true);
    const patched = await readFile(filePath, 'utf-8');
    expect(patched.includes('shape-compat-1')).toBe(true);
    expect(patched.includes('x={48}')).toBe(true);
    expect(patched.includes('y={96}')).toBe(true);
  });

  it('node.create: canvas-absolute placement를 그대로 저장한다', async () => {
    const filePath = await makeTempTsx(`export default function Sample(){ return <Canvas><Node id="root" /></Canvas>; }`);
    const original = await readFile(filePath, 'utf-8');

    const result = await methods['node.create']({
      filePath,
      node: {
        id: 'shape-1',
        type: 'shape',
        props: { content: 'Card' },
        placement: { mode: 'canvas-absolute', x: 140, y: 220 },
      },
      baseVersion: sha(original),
      originId: 'client-1',
      commandId: 'cmd-create-placement-canvas',
    }, { ws: {}, subscriptions: new Set() }) as { success: boolean };

    expect(result.success).toBe(true);
    const patched = await readFile(filePath, 'utf-8');
    expect(patched.includes('<Shape')).toBe(true);
    expect(patched.includes('x={140}')).toBe(true);
    expect(patched.includes('y={220}')).toBe(true);
  });

  it('node.create: mindmap-child placement를 같은 MindMap scope에 삽입한다', async () => {
    const filePath = await makeTempTsx(`
      export default function Sample(){
        return <Canvas>
          <MindMap id="map"><Node id="root">Root</Node></MindMap>
        </Canvas>;
      }
    `);
    const original = await readFile(filePath, 'utf-8');

    const result = await methods['node.create']({
      filePath,
      node: {
        id: 'child-1',
        type: 'shape',
        props: { content: 'Child' },
        placement: { mode: 'mindmap-child', parentId: 'root' },
      },
      baseVersion: sha(original),
      originId: 'client-1',
      commandId: 'cmd-create-placement-mindmap',
    }, { ws: {}, subscriptions: new Set() }) as { success: boolean };

    expect(result.success).toBe(true);
    const patched = await readFile(filePath, 'utf-8');
    expect(patched.includes('id={"child-1"}')).toBe(true);
    expect(patched.includes('from={"root"}')).toBe(true);
  });

  it('node.update: from object payload를 그대로 저장한다', async () => {
    const filePath = await makeTempTsx(`
      export default function Sample(){ return <Canvas><Shape id="n1" /></Canvas>; }
    `);
    const original = await readFile(filePath, 'utf-8');

    const result = await methods['node.update']({
      filePath,
      nodeId: 'n1',
      props: {
        from: {
          node: 'root',
          edge: { pattern: 'dashed', label: { text: 'L1' } },
        },
      },
      baseVersion: sha(original),
      originId: 'client-1',
      commandId: 'cmd-update-object-from',
    }, { ws: {}, subscriptions: new Set() }) as { success: boolean };

    expect(result.success).toBe(true);
    const patched = await readFile(filePath, 'utf-8');
    expect(patched.includes('node: "root"')).toBe(true);
    expect(patched.includes('pattern: "dashed"')).toBe(true);
    expect(patched.includes('text: "L1"')).toBe(true);
  });

  it('node.update: commandType=content.update 는 label carrier를 최소 diff로 갱신한다', async () => {
    const filePath = await makeTempTsx(`
      export default function Sample(){ return <Canvas><Node id="n1" label={"Before"} x={1} y={2} /></Canvas>; }
    `);
    const original = await readFile(filePath, 'utf-8');

    const result = await methods['node.update']({
      filePath,
      nodeId: 'n1',
      props: { content: 'After' },
      commandType: 'node.content.update',
      baseVersion: sha(original),
      originId: 'client-1',
      commandId: 'cmd-update-content',
    }, { ws: {}, subscriptions: new Set() }) as { success: boolean };

    expect(result.success).toBe(true);
    const patched = await readFile(filePath, 'utf-8');
    expect(patched.includes('label={"After"}')).toBe(true);
    expect(patched.includes('x={1}')).toBe(true);
    expect(patched.includes('y={2}')).toBe(true);
  });

  it('node.update: commandType=style.update 에서 비허용 필드는 PATCH_SURFACE_VIOLATION + rollback diagnostics로 거부한다', async () => {
    const filePath = await makeTempTsx(`
      export default function Sample(){ return <Canvas><Sticker id="st-1" outlineColor={"#fff"}>Hi</Sticker></Canvas>; }
    `);
    const original = await readFile(filePath, 'utf-8');

    let error: unknown;
    try {
      await methods['node.update']({
        filePath,
        nodeId: 'st-1',
        props: { anchor: 'other' },
        commandType: 'node.style.update',
        baseVersion: sha(original),
        originId: 'client-1',
        commandId: 'cmd-update-style-invalid',
      }, { ws: {}, subscriptions: new Set() });
    } catch (cause) {
      error = cause;
    }

    expect(error).toBeDefined();
    const rejection = error as { code?: number; message?: string; data?: unknown };
    expect(rejection.code).toBe(42211);
    expect(rejection.message).toBe('PATCH_SURFACE_VIOLATION');
    if (rejection.data && typeof rejection.data === 'object') {
      const data = rejection.data as {
        rejectedKeys?: string[];
        rollback?: { failedAction?: string; rollbackPolicy?: string; stage?: string };
      };
      expect(data.rejectedKeys).toEqual(['anchor']);
      expect(data.rollback?.failedAction).toBe('node.style.update');
      expect(data.rollback?.rollbackPolicy).toBe('intent-scoped');
      expect(data.rollback?.stage).toBe('ws.node.update');
    }
  });

  it('node.create: sticker 타입을 허용하고 Sticker로 생성한다', async () => {
    const filePath = await makeTempTsx(`export default function Sample(){ return <Canvas><Node id="root" /></Canvas>; }`);
    const original = await readFile(filePath, 'utf-8');

    const result = await methods['node.create']({
      filePath,
      node: {
        id: 'st-1',
        type: 'sticker',
        props: {
          x: 12,
          y: 34,
          text: 'S',
          anchor: 'root',
          position: 'right',
          pattern: { type: 'preset', id: 'lined-warm' },
        },
      },
      baseVersion: sha(original),
      originId: 'client-1',
      commandId: 'cmd-2b',
    }, { ws: {}, subscriptions: new Set() }) as { success: boolean };

    expect(result.success).toBe(true);
    const patched = await readFile(filePath, 'utf-8');
    expect(patched.includes('<Sticker')).toBe(true);
    expect(patched.includes('id={"st-1"}')).toBe(true);
    expect(patched.includes('anchor={"root"}')).toBe(true);
    expect(patched.includes('position={"right"}')).toBe(true);
    expect(patched.includes('type: "preset"')).toBe(true);
    expect(patched.includes('id: "lined-warm"')).toBe(true);
  });

  it('node.create: washi-tape 타입을 허용하고 WashiTape로 생성한다', async () => {
    const filePath = await makeTempTsx(`export default function Sample(){ return <Canvas><Node id="root" /></Canvas>; }`);
    const original = await readFile(filePath, 'utf-8');

    const result = await methods['node.create']({
      filePath,
      node: {
        id: 'w-1',
        type: 'washi-tape',
        props: {
          pattern: { type: 'preset', id: 'pastel-dots' },
          at: { type: 'polar', x: 10, y: 20, length: 180, thickness: 36 },
          opacity: 0.9,
        },
      },
      baseVersion: sha(original),
      originId: 'client-1',
      commandId: 'cmd-2c',
    }, { ws: {}, subscriptions: new Set() }) as { success: boolean };

    expect(result.success).toBe(true);
    const patched = await readFile(filePath, 'utf-8');
    expect(patched.includes('<WashiTape')).toBe(true);
    expect(patched.includes('id={"w-1"}')).toBe(true);
    expect(patched.includes('type: "preset"')).toBe(true);
    expect(patched.includes('id: "pastel-dots"')).toBe(true);
    expect(patched.includes('length: 180')).toBe(true);
  });

  it('node.reparent: cycle이면 40902(MINDMAP_CYCLE)', async () => {
    const filePath = await makeTempTsx(`
      export default function Sample(){
        return <Canvas>
          <Node id="a" />
          <Node id="b" from="a" />
          <Node id="c" from="b" />
        </Canvas>;
      }
    `);
    const original = await readFile(filePath, 'utf-8');

    await expect(methods['node.reparent']({
      filePath,
      nodeId: 'a',
      newParentId: 'c',
      baseVersion: sha(original),
      originId: 'client-1',
      commandId: 'cmd-3',
    }, { ws: {}, subscriptions: new Set() })).rejects.toMatchObject({ code: 40902, message: 'MINDMAP_CYCLE' });
  });

  it('node.reparent: from object 사용 시 edge payload를 보존한다', async () => {
    const filePath = await makeTempTsx(`
      export default function Sample(){
        return <Canvas>
          <Node id="a" />
          <Node id="c" />
          <Shape id="b" from={{ node: "a", edge: { label: { text: "r" }, stroke: "#ef4444" } }} />
        </Canvas>;
      }
    `);
    const original = await readFile(filePath, 'utf-8');

    const result = await methods['node.reparent']({
      filePath,
      nodeId: 'b',
      newParentId: 'c',
      baseVersion: sha(original),
      originId: 'client-1',
      commandId: 'cmd-reparent-object-from',
    }, { ws: {}, subscriptions: new Set() }) as { success: boolean };

    expect(result.success).toBe(true);
    const patched = await readFile(filePath, 'utf-8');
    expect(patched.includes('node: "c"')).toBe(true);
    expect(patched.includes('stroke: "#ef4444"')).toBe(true);
    expect(patched.includes('text: "r"')).toBe(true);
  });

  it('node.reparent: 다른 MindMap scope 부모는 EDIT_NOT_ALLOWED 로 거부한다', async () => {
    const filePath = await makeTempTsx(`
      export default function Sample(){
        return <Canvas>
          <MindMap id="map-a">
            <Node id="a-root">A</Node>
            <Node id="a-child" from="a-root">Child</Node>
          </MindMap>
          <MindMap id="map-b">
            <Node id="b-root">B</Node>
          </MindMap>
        </Canvas>;
      }
    `);
    const original = await readFile(filePath, 'utf-8');

    await expect(methods['node.reparent']({
      filePath,
      nodeId: 'a-child',
      newParentId: 'b-root',
      baseVersion: sha(original),
      originId: 'client-1',
      commandId: 'cmd-reparent-cross-scope',
    }, { ws: {}, subscriptions: new Set() })).rejects.toMatchObject({
      code: 42201,
      message: 'EDIT_NOT_ALLOWED',
    });
  });

  it('node.delete: 생성된 노드를 제거한다', async () => {
    const filePath = await makeTempTsx(`export default function Sample(){ return <Canvas><Node id="root" /><Text id="temp">Temp</Text></Canvas>; }`);
    const original = await readFile(filePath, 'utf-8');

    const result = await methods['node.delete']({
      filePath,
      nodeId: 'temp',
      baseVersion: sha(original),
      originId: 'client-1',
      commandId: 'cmd-delete-temp',
    }, { ws: {}, subscriptions: new Set() }) as { success: boolean };

    expect(result.success).toBe(true);
    const patched = await readFile(filePath, 'utf-8');
    expect(patched.includes('id="temp"')).toBe(false);
  });

  it('node.update: Image content-kind mismatch는 CONTENT_CONTRACT_VIOLATION + diagnostics로 거부한다', async () => {
    const filePath = await makeTempTsx(`
      export default function Sample() {
        return <Canvas>
          <Image id="img-mismatch" src={"https://example.com/media.png"} alt={"media"}></Image>
        </Canvas>;
      }
    `);
    const original = await readFile(filePath, 'utf-8');

    let error: unknown;
    try {
      await methods['node.update']({
        filePath,
        nodeId: 'img-mismatch',
        props: { content: '# mismatch' },
        commandType: 'node.content.update',
        baseVersion: sha(original),
        originId: 'client-1',
        commandId: 'cmd-content-kind-mismatch',
      }, { ws: {}, subscriptions: new Set() });
    } catch (cause) {
      error = cause;
    }

    expect(error).toBeDefined();
    const rejection = error as { code?: number; message?: string; data?: unknown };
    expect(rejection.code).toBe(42208);
    expect(rejection.message).toBe('CONTENT_CONTRACT_VIOLATION');
    if (rejection.data && typeof rejection.data === 'object') {
      const data = rejection.data as {
        path?: string;
        diagnostics?: { path?: string };
        rollback?: { failedAction?: string; rollbackPolicy?: string; stage?: string };
      };
      expect(data.path ?? data.diagnostics?.path).toBe('capabilities.content');
      expect(data.rollback?.failedAction).toBe('node.content.update');
      expect(data.rollback?.rollbackPolicy).toBe('intent-scoped');
      expect(data.rollback?.stage).toBe('ws.node.update');
    }
  });

  it('node.update: node.style.update 명령은 Node/Shape alias에서 동일하게 동작한다', async () => {
    const nodePath = await makeTempTsx(`
      export default function Sample() {
        return <Canvas><Node id="node-alias" /></Canvas>;
      }
    `);
    const shapePath = await makeTempTsx(`
      export default function Sample() {
        return <Canvas><Shape id="shape-alias" /></Canvas>;
      }
    `);

    const nodeOriginal = await readFile(nodePath, 'utf-8');
    const shapeOriginal = await readFile(shapePath, 'utf-8');

    const nodeResult = await methods['node.update']({
      filePath: nodePath,
      nodeId: 'node-alias',
      props: { fill: '#22c55e' },
      commandType: 'node.style.update',
      baseVersion: sha(nodeOriginal),
      originId: 'client-1',
      commandId: 'cmd-style-update-node',
    }, { ws: {}, subscriptions: new Set() }) as { success: boolean; newVersion: string };

    const nodePatched = await readFile(nodePath, 'utf-8');
    const shapeResult = await methods['node.update']({
      filePath: shapePath,
      nodeId: 'shape-alias',
      props: { fill: '#22c55e' },
      commandType: 'node.style.update',
      baseVersion: sha(shapeOriginal),
      originId: 'client-1',
      commandId: 'cmd-style-update-shape',
    }, { ws: {}, subscriptions: new Set() }) as { success: boolean; newVersion: string };

    const shapePatched = await readFile(shapePath, 'utf-8');

    expect(nodeResult.success).toBe(true);
    expect(shapeResult.success).toBe(true);
    expect(nodePatched.includes('id="node-alias"')).toBe(true);
    expect(shapePatched.includes('id="shape-alias"')).toBe(true);
    expect(nodePatched.includes('fill={"#22c55e"}')).toBe(true);
    expect(shapePatched.includes('fill={"#22c55e"}')).toBe(true);
  });

  it('node.update: node.style.update에서 content 전용 필드(patch)로 비허용 계약을 바꾸면 CONTENT_CONTRACT_VIOLATION', async () => {
    const filePath = await makeTempTsx(`
      export default function Sample() {
        return <Canvas><Node id="node-invalid" /></Canvas>;
      }
    `);
    const original = await readFile(filePath, 'utf-8');

    let error: unknown;
    try {
      await methods['node.update']({
        filePath,
        nodeId: 'node-invalid',
        props: { participants: ['A', 'B'] },
        commandType: 'node.style.update',
        baseVersion: sha(original),
        originId: 'client-1',
        commandId: 'cmd-style-invalid-contract',
      }, { ws: {}, subscriptions: new Set() });
    } catch (cause) {
      error = cause;
    }

    expect(error).toBeDefined();
    const rejection = error as { code?: number; message?: string; data?: unknown };
    expect(rejection.code).toBe(42208);
    expect(rejection.message).toBe('CONTENT_CONTRACT_VIOLATION');
    if (rejection.data && typeof rejection.data === 'object') {
      const data = rejection.data as {
        path?: string;
        diagnostics?: { path?: string };
        rollback?: { failedAction?: string; rollbackPolicy?: string; stage?: string };
      };
      expect(data.path ?? data.diagnostics?.path).toBe('capabilities.content');
      expect(data.rollback?.failedAction).toBe('node.style.update');
      expect(data.rollback?.rollbackPolicy).toBe('intent-scoped');
      expect(data.rollback?.stage).toBe('ws.node.update');
    }
  });

  it('node.create: missing mindmap parent exposes intent-scoped rollback diagnostics for composite entrypoint failure', async () => {
    const filePath = await makeTempTsx(`
      export default function Sample(){
        return <Canvas><MindMap id="map"><Node id="root">Root</Node></MindMap></Canvas>;
      }
    `);
    const original = await readFile(filePath, 'utf-8');

    let error: unknown;
    try {
      await methods['node.create']({
        filePath,
        node: {
          id: 'child-missing-parent',
          type: 'shape',
          props: { content: 'Child' },
          placement: { mode: 'mindmap-child', parentId: 'missing-parent' },
        },
        baseVersion: sha(original),
        originId: 'client-1',
        commandId: 'cmd-create-missing-parent',
      }, { ws: {}, subscriptions: new Set() });
    } catch (cause) {
      error = cause;
    }

    expect(error).toBeDefined();
    const rejection = error as { code?: number; message?: string; data?: unknown };
    expect(rejection.code).toBe(40401);
    expect(rejection.message).toBe('NODE_NOT_FOUND');
    if (rejection.data && typeof rejection.data === 'object') {
      const data = rejection.data as {
        nodeId?: string;
        rollback?: { failedAction?: string; rollbackPolicy?: string; stage?: string };
      };
      expect(data.nodeId).toBe('child-missing-parent');
      expect(data.rollback?.failedAction).toBe('node.create');
      expect(data.rollback?.rollbackPolicy).toBe('intent-scoped');
      expect(data.rollback?.stage).toBe('ws.node.create');
    }
  });

  it('bridge planned rename descriptor는 node.update RPC shape로 그대로 실행된다', async () => {
    const filePath = await makeTempTsx(`
      export default function Sample(){ return <Canvas><Node id="n1" label={"Before"} /></Canvas>; }
    `);
    const original = await readFile(filePath, 'utf-8');

    const routed = routeIntent({
      envelope: createRenameIntentEnvelope({
        selectionRef: {
          currentFile: filePath,
          selectedNodeIds: ['n1'],
        },
        targetRef: {
          renderedNodeId: 'n1',
        },
      }),
      context: makeActionRoutingContext({
        nodes: [
          makeCanonicalNode({
            id: 'n1',
            type: 'shape',
            filePath,
            data: { label: 'Before' },
          }),
        ],
        currentFile: filePath,
        sourceVersions: { [filePath]: sha(original) },
      }),
    });

    expect(routed.ok).toBe(true);
    if (!routed.ok) return;
    const step = routed.value.steps[0] as MutationDispatchDescriptor<'node.update'>;
    const result = await methods[step.actionId]({
      ...step.payload,
      baseVersion: sha(original),
      originId: 'client-bridge',
      commandId: 'cmd-bridge-rename',
    }, { ws: {}, subscriptions: new Set() }) as { success: boolean };

    expect(result.success).toBe(true);
    const patched = await readFile(filePath, 'utf-8');
    expect(patched.includes('id={"shape-1-renamed"}')).toBe(true);
  });

  it('bridge planned create descriptor는 node.create RPC shape로 그대로 실행된다', async () => {
    const filePath = await makeTempTsx(`
      export default function Sample(){ return <Canvas><Node id="root" /></Canvas>; }
    `);
    const original = await readFile(filePath, 'utf-8');

    const routed = routeIntent({
      envelope: createPaneCreateIntentEnvelope({
        selectionRef: {
          currentFile: filePath,
          selectedNodeIds: [],
        },
      }),
      context: makeActionRoutingContext({
        currentFile: filePath,
        sourceVersions: { [filePath]: sha(original) },
      }),
    });

    expect(routed.ok).toBe(true);
    if (!routed.ok) return;
    const step = routed.value.steps[0] as MutationDispatchDescriptor<'node.create'>;
    const result = await methods[step.actionId]({
      ...step.payload,
      baseVersion: sha(original),
      originId: 'client-bridge',
      commandId: 'cmd-bridge-create',
    }, { ws: {}, subscriptions: new Set() }) as { success: boolean };

    expect(result.success).toBe(true);
    const patched = await readFile(filePath, 'utf-8');
    expect(patched.includes('<Shape')).toBe(true);
  });
});
