import { afterEach, describe, expect, it, mock } from 'bun:test';
import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { basename, dirname, join } from 'path';
import { tmpdir } from 'os';
import { createHash } from 'crypto';
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

  it('node.update: commandType=style.update 에서 비허용 필드는 EDIT_NOT_ALLOWED 로 거부한다', async () => {
    const filePath = await makeTempTsx(`
      export default function Sample(){ return <Canvas><Sticker id="st-1" outlineColor={"#fff"}>Hi</Sticker></Canvas>; }
    `);
    const original = await readFile(filePath, 'utf-8');

    await expect(methods['node.update']({
      filePath,
      nodeId: 'st-1',
      props: { anchor: 'other' },
      commandType: 'node.style.update',
      baseVersion: sha(original),
      originId: 'client-1',
      commandId: 'cmd-update-style-invalid',
    }, { ws: {}, subscriptions: new Set() })).rejects.toMatchObject({
      code: 42201,
      message: 'EDIT_NOT_ALLOWED',
    });
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
});
