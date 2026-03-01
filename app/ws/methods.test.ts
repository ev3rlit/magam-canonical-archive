import { afterEach, describe, expect, it, mock } from 'bun:test';
import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { createHash } from 'crypto';
import { methods } from './methods';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
  tempDirs.length = 0;
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

  it('node.create: sticker 타입을 허용하고 Sticky로 생성한다', async () => {
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
    expect(patched.includes('<Sticky')).toBe(true);
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
});
