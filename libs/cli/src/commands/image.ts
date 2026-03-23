import { readFile, rename, writeFile, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { parse } from '@babel/parser';
import generate from '@babel/generator';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
import { CLI_MESSAGES } from '../messages';

type InsertMode = 'node' | 'markdown' | 'canvas' | 'shape';

interface ImageInsertOptions {
  file: string;
  source: string;
  mode: InsertMode;
  target?: string;
  alt?: string;
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  fit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
  id?: string;
}

const ALLOWED_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg']);
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const SUPPORTED_MODES: InsertMode[] = ['node', 'markdown', 'canvas', 'shape'];

function fail(message: string, code = 1): never {
  console.error(`✗ ${message}`);
  process.exit(code);
}

function parseArgs(rawArgs: string[]): ImageInsertOptions {
  const args: Record<string, string> = {};

  for (let i = 0; i < rawArgs.length; i += 1) {
    const token = rawArgs[i];
    if (!token.startsWith('--')) {
      fail(CLI_MESSAGES.image.unknownArgument(token));
    }

    const key = token.slice(2);
    const next = rawArgs[i + 1];

    if (!next || next.startsWith('--')) {
      args[key] = 'true';
      continue;
    }

    args[key] = next;
    i += 1;
  }

  const file = args.file || '';
  const source = args.source || '';
  const mode = args.mode as InsertMode | undefined;
  const target = args.target;
  const alt = args.alt;

  if (!file) fail(CLI_MESSAGES.image.fileRequired);
  if (!source) fail(CLI_MESSAGES.image.sourceRequired);
  if (!mode || !SUPPORTED_MODES.includes(mode)) {
    fail(CLI_MESSAGES.image.modeMustBeOneOf(SUPPORTED_MODES));
  }

  const width = args.width !== undefined ? Number(args.width) : undefined;
  const height = args.height !== undefined ? Number(args.height) : undefined;
  const x = args.x !== undefined ? Number(args.x) : undefined;
  const y = args.y !== undefined ? Number(args.y) : undefined;
  const fit = args.fit as ImageInsertOptions['fit'] | undefined;
  const id = args.id;

  if (width !== undefined && !Number.isFinite(width)) fail(CLI_MESSAGES.image.widthMustBeNumber);
  if (height !== undefined && !Number.isFinite(height)) fail(CLI_MESSAGES.image.heightMustBeNumber);
  if (x !== undefined && !Number.isFinite(x)) fail(CLI_MESSAGES.image.xMustBeNumber);
  if (y !== undefined && !Number.isFinite(y)) fail(CLI_MESSAGES.image.yMustBeNumber);
  if (fit && !['cover', 'contain', 'fill', 'none', 'scale-down'].includes(fit)) {
    fail(CLI_MESSAGES.image.fitMustBeOneOf);
  }

  if ((mode === 'node' || mode === 'markdown' || mode === 'shape') && !target) {
    fail(CLI_MESSAGES.image.targetRequiredForMode(mode));
  }

  return {
    file,
    source,
    mode,
    target,
    alt,
    width,
    height,
    x,
    y,
    fit,
    id,
  };
}

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function resolveWorkspaceRoot(): string {
  const envRoot = process.env.MAGAM_TARGET_DIR;
  return path.resolve(envRoot || process.cwd());
}

function resolveFileInWorkspace(root: string, filePath: string): string {
  const absolute = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
  if (!absolute.startsWith(root)) {
    fail(CLI_MESSAGES.image.fileMustBeInsideWorkspaceRoot(root));
  }
  return absolute;
}

function toRelativeImportPath(fromFile: string, targetFile: string): string {
  const relative = path.relative(path.dirname(fromFile), targetFile).replace(/\\/g, '/');
  if (relative.startsWith('.')) {
    return relative;
  }
  return `./${relative}`;
}

function hashBuffer(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex').slice(0, 8);
}

function validateImageSourceName(fileName: string): string {
  const extension = path.extname(fileName).replace(/^\./, '').toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    fail(CLI_MESSAGES.image.unsupportedExtension(extension));
  }
  if (!extension) fail(CLI_MESSAGES.image.sourceFileHasNoExtension);
  return extension;
}

function detectImageType(buffer: Buffer, extensionHint: string): string {
  if (extensionHint === 'png' && buffer.slice(0, 8).toString('hex') === '89504e470d0a1a0a') return 'png';
  if (extensionHint.startsWith('jp') && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return extensionHint === 'jpeg' ? 'jpeg' : 'jpg';
  if (extensionHint === 'gif' && buffer.slice(0, 3).toString() === 'GIF') return 'gif';
  if (extensionHint === 'webp' && buffer.slice(0, 4).toString() === 'RIFF' && buffer.slice(8, 12).toString() === 'WEBP') return 'webp';

  const head = buffer.slice(0, 256).toString('utf8').trim();
  if (extensionHint === 'svg' && (/^<\?xml/i.test(head) || /^<svg/i.test(head))) return 'svg';

  return '';
}

function getNumericAttr(name: string, value?: number): t.JSXAttribute | null {
  if (value === undefined) return null;
  return t.jsxAttribute(
    t.jsxIdentifier(name),
    t.jsxExpressionContainer(t.numericLiteral(value)),
  );
}

function getStringAttr(name: string, value?: string): t.JSXAttribute | null {
  if (!value) return null;
  return t.jsxAttribute(t.jsxIdentifier(name), t.stringLiteral(value));
}

type JsxOpenLike = t.JSXOpeningElement | t.JSXSelfClosingElement;

function getJSXStringAttributeValue(value: t.JSXAttribute['value']): string | undefined {
  if (!value) return undefined;
  if (t.isStringLiteral(value)) return value.value;
  if (t.isJSXExpressionContainer(value)) {
    if (t.isStringLiteral(value.expression)) return value.expression.value;
    if (t.isTemplateLiteral(value.expression) && value.expression.expressions.length === 0) {
      return value.expression.quasis.map((q) => q.value.cooked || q.value.raw).join('');
    }
  }
  return undefined;
}

function isTargetElement(node: JsxOpenLike, componentName: string, targetId?: string) {
  if (!t.isJSXIdentifier(node.name) || node.name.name !== componentName) return false;
  if (!targetId) return true;

  const found = node.attributes.find((attr): attr is t.JSXAttribute => (
    t.isJSXAttribute(attr)
    && t.isJSXIdentifier(attr.name)
    && attr.name.name === 'id'
    && getJSXStringAttributeValue(attr.value) === targetId
  ));

  return Boolean(found);
}

function replaceWithJsxElement(path: any, replacement: t.JSXElement) {
  path.replaceWith(replacement);
}

function setOpeningAttr(opening: JsxOpenLike, name: string, value: string | undefined): void {
  if (value === undefined) return;
  const existing = opening.attributes.findIndex((attr): attr is t.JSXAttribute => (
    t.isJSXAttribute(attr) && t.isJSXIdentifier(attr.name) && attr.name.name === name
  ));

  if (existing >= 0) {
    const existingAttr = opening.attributes[existing];
    if (t.isJSXAttribute(existingAttr)) {
      existingAttr.value = t.stringLiteral(value);
    }
  } else {
    opening.attributes.push(t.jsxAttribute(t.jsxIdentifier(name), t.stringLiteral(value)));
  }
}

function createImageElement(options: {
  source: string;
  alt?: string;
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  fit?: ImageInsertOptions['fit'];
  id?: string;
}): t.JSXElement {
  const attrs: Array<t.JSXAttribute | t.JSXSpreadAttribute> = [
    getStringAttr('src', options.source),
  ].filter((item): item is t.JSXAttribute => item !== null);

  if (options.id) {
    const idAttr = getStringAttr('id', options.id);
    if (idAttr) attrs.push(idAttr);
  }

  const alt = getStringAttr('alt', options.alt);
  if (alt) attrs.push(alt);

  const width = getNumericAttr('width', options.width);
  if (width) attrs.push(width);

  const height = getNumericAttr('height', options.height);
  if (height) attrs.push(height);

  const x = getNumericAttr('x', options.x);
  if (x) attrs.push(x);

  const y = getNumericAttr('y', options.y);
  if (y) attrs.push(y);

  if (options.fit) {
    attrs.push(t.jsxAttribute(t.jsxIdentifier('fit'), t.stringLiteral(options.fit)));
  }

  const opening = t.jsxOpeningElement(t.jsxIdentifier('Image'), attrs, true);
  return t.jsxElement(opening, null, [], true);
}

function createMarkdownToken(alt: string | undefined, source: string): string {
  const escapedAlt = alt
    ? alt.replace(/[\]\\[*()]/g, '\\$&')
    : '';
  return `\n![${escapedAlt}](${source})`;
}

function getMarkdownText(node: t.JSXElement): string | null {
  const children = node.children.filter((item) => item.type !== 'JSXText' || Boolean(item.value.trim()));
  if (children.length === 0) return '';

  if (children.length > 1) {
    return null;
  }

  const child = children[0];
  if (child.type === 'JSXExpressionContainer') {
    if (t.isStringLiteral(child.expression)) {
      return child.expression.value;
    }
    if (t.isTemplateLiteral(child.expression) && child.expression.expressions.length === 0) {
      return child.expression.quasis.map((q) => q.value.cooked || q.value.raw).join('');
    }
  }

  if (child.type === 'JSXText' && typeof child.value === 'string') {
    return child.value;
  }

  return null;
}

function replaceMarkdownContent(
  node: t.JSXElement,
  nextContent: string,
): void {
  const line = nextContent;
  if (!node.openingElement.selfClosing) {
    node.children = [t.jsxExpressionContainer(t.stringLiteral(line))];
    return;
  }

  const opening = t.jsxOpeningElement(node.openingElement.name, node.openingElement.attributes, false);
  node.openingElement = opening;
  node.closingElement = t.jsxClosingElement(node.openingElement.name);
  node.children = [t.jsxExpressionContainer(t.stringLiteral(line))];
}

function ensureImageImport(ast: t.File) {
  const body = ast.program.body;
  const coreImportIndex = body.findIndex((item) => (
    t.isImportDeclaration(item) && item.source.value === '@magam/core'
  ));

  if (coreImportIndex < 0) {
    let insertIndex = 0;
    while (insertIndex < body.length) {
      const stmt = body[insertIndex];
      if (t.isImportDeclaration(stmt)) {
        break;
      }

      if (t.isExpressionStatement(stmt) && (stmt as any).directive) {
        insertIndex += 1;
        continue;
      }

      break;
    }

    body.splice(insertIndex, 0,
      t.importDeclaration(
        [t.importSpecifier(t.identifier('Image'), t.identifier('Image'))],
        t.stringLiteral('@magam/core'),
      ),
    );
    return;
  }

  const coreImport = body[coreImportIndex] as t.ImportDeclaration;
  const hasImageImport = coreImport.specifiers.some((spec) => (
    t.isImportSpecifier(spec)
    && t.isIdentifier(spec.imported)
    && spec.imported.name === 'Image'
  ));

  if (!hasImageImport) {
    coreImport.specifiers.push(t.importSpecifier(t.identifier('Image'), t.identifier('Image')));
  }
}

function patchNodeChildren(ast: t.File, targetNodeId: string, imageNode: t.JSXElement): boolean {
  let updated = false;

  traverse(ast, {
    JSXElement(path) {
      if (updated) return;

      const opening = path.node.openingElement;
      if (!isTargetElement(opening, 'Node', targetNodeId)) return;

      if (opening.selfClosing) {
        const openingWithChildren = t.jsxOpeningElement(opening.name, opening.attributes, false);
        const closing = t.jsxClosingElement(opening.name as t.JSXTagNameExpression);
        replaceWithJsxElement(path, t.jsxElement(openingWithChildren, closing, [imageNode], false));
        updated = true;
        return;
      }

      path.node.children.push(t.jsxText('\n'));
      path.node.children.push(imageNode);
      updated = true;
    },
  });

  return updated;
}

function patchShapeImage(ast: t.File, targetNodeId: string, source: string, fit?: ImageInsertOptions['fit']) {
  let updated = false;

  traverse(ast, {
    JSXElement(path) {
      if (updated) return;
      const opening = path.node.openingElement;
      if (!isTargetElement(opening, 'Shape', targetNodeId)) return;

      setOpeningAttr(opening, 'imageSrc', source);
      if (fit) setOpeningAttr(opening, 'imageFit', fit);

      updated = true;
    },
  });

  return updated;
}

function patchMarkdown(ast: t.File, target: string, token: string): boolean {
  let updated = false;
  let fallbackNode: t.JSXElement | null = null;
  let fallbackText: string | null = null;

  const applyMarkdownToken = (markdownNode: t.JSXElement) => {
    if (updated) return;

    const current = getMarkdownText(markdownNode);
    if (current === null) fail(CLI_MESSAGES.image.markdownNodeContentNotSupported);

    replaceMarkdownContent(markdownNode, `${current}${token}`);
    updated = true;
  };

  traverse(ast, {
    JSXElement(path) {
      if (updated) return;

      const opening = path.node.openingElement;
      if (!isTargetElement(opening, 'Markdown', target)) {
        return;
      }

      applyMarkdownToken(path.node);
    },
  });

  if (updated) return true;

  traverse(ast, {
    JSXElement(path) {
      if (updated) return;

      const opening = path.node.openingElement;
      if (!isTargetElement(opening, 'Node', target)) return;

      fallbackNode = null;
      path.node.children.forEach((child) => {
        if (fallbackNode || child.type !== 'JSXElement') return;
        if (t.isJSXIdentifier((child as t.JSXElement).openingElement.name)
          && (child as t.JSXElement).openingElement.name.name === 'Markdown') {
          fallbackNode = child as t.JSXElement;
        }
      });

      if (!fallbackNode) return;

      fallbackText = getMarkdownText(fallbackNode);
      if (fallbackText === null) return;

      fallbackText = `${fallbackText}${token}`;
      replaceMarkdownContent(fallbackNode, fallbackText);
      updated = true;
    },
  });

  if (!updated) {
    fail(CLI_MESSAGES.image.targetMarkdownNodeNotFound(target));
  }

  return true;
}

async function insertCanvasImage(ast: t.File, imageNode: t.JSXElement) {
  let updated = false;
  traverse(ast, {
    JSXElement(path) {
      if (updated) return;
      const opening = path.node.openingElement;
      if (!isTargetElement(opening, 'Canvas')) return;

      if (opening.selfClosing) {
        const openingWithChildren = t.jsxOpeningElement(opening.name, opening.attributes, false);
        const closing = t.jsxClosingElement(opening.name as t.JSXTagNameExpression);
        replaceWithJsxElement(path, t.jsxElement(openingWithChildren, closing, [t.jsxText('\n'), imageNode, t.jsxText('\n')], false));
        updated = true;
        return;
      }

      path.node.children.push(t.jsxText('\n'));
      path.node.children.push(imageNode);
      updated = true;
    },
  });

  if (!updated) fail(CLI_MESSAGES.image.canvasComponentNotFound);
}

async function uploadLocalSource(
  source: string,
  workspaceRoot: string,
): Promise<string> {
  const ext = validateImageSourceName(path.basename(source));
  const absolute = path.resolve(process.cwd(), source);
  const data = await readFile(absolute);
  const statResult = await stat(absolute);

  if (statResult.size <= 0) {
    fail(CLI_MESSAGES.image.sourceFileEmpty);
  }
  if (statResult.size > MAX_IMAGE_BYTES) {
    fail(CLI_MESSAGES.image.sourceFileTooLarge);
  }

  const detected = detectImageType(data, ext);
  if (!detected) {
    fail(CLI_MESSAGES.image.signatureVerificationFailed);
  }

  const base = sanitizeBaseName(path.parse(absolute).name);
  const finalExt = detected === 'jpeg' ? 'jpg' : detected;
  const savedName = `${base}-${hashBuffer(data)}.${finalExt}`;
  const destinationRoot = path.join(workspaceRoot, 'assets', 'images');
  const destination = path.join(destinationRoot, savedName);

  await mkdir(destinationRoot, { recursive: true });

  try {
    await writeFile(destination, data, { flag: 'wx' });
  } catch (error: any) {
    if (error?.code === 'EEXIST') {
      // keep existing asset (likely same hashed file)
      return destination;
    }
    throw error;
  }

  return destination;
}

function sanitizeMarkdownInput(value: string | undefined): string {
  if (!value) return '';
  return value.trim();
}

function normalizeSourceForPatch(rawSource: string, sourcePath: string, filePath: string): string {
  if (isHttpUrl(rawSource)) return rawSource;
  return toRelativeImportPath(filePath, sourcePath);
}

export async function insertImageCommand(rawArgs: string[]) {
  const options = parseArgs(rawArgs);
  const workspaceRoot = resolveWorkspaceRoot();
  const filePath = resolveFileInWorkspace(workspaceRoot, options.file);

  const code = await readFile(filePath, 'utf-8');
  const ast = parse(code, { sourceType: 'module', plugins: ['typescript', 'jsx'] }) as t.File;

  let sourceForPatch: string;
  let sourceLabel: string;

  if (isHttpUrl(options.source)) {
    if (options.source.length > 2048) fail(CLI_MESSAGES.image.sourceUrlTooLong);
    if (!/^https?:\/\//i.test(options.source)) fail(CLI_MESSAGES.image.sourceMustBeHttpUrl);
    sourceForPatch = options.source;
    sourceLabel = options.source;
  } else {
    const uploaded = await uploadLocalSource(options.source, workspaceRoot);
    sourceForPatch = normalizeSourceForPatch(options.source, uploaded, filePath);
    sourceLabel = uploaded;
  }

  const imageNode = createImageElement({
    source: sourceForPatch,
    alt: sanitizeMarkdownInput(options.alt),
    width: options.width,
    height: options.height,
    x: options.x,
    y: options.y,
    fit: options.fit,
    id: options.id,
  });

  switch (options.mode) {
    case 'node': {
      const patched = patchNodeChildren(ast, options.target!, imageNode);
      if (!patched) fail(CLI_MESSAGES.image.targetNodeNotFound(options.target!));
      ensureImageImport(ast);
      break;
    }
    case 'canvas': {
      await insertCanvasImage(ast, imageNode);
      ensureImageImport(ast);
      break;
    }
    case 'shape': {
      if (!options.target) fail(CLI_MESSAGES.image.targetRequiredForShapeMode);
      const patched = patchShapeImage(ast, options.target, sourceForPatch, options.fit);
      if (!patched) fail(CLI_MESSAGES.image.targetShapeNotFound(options.target));
      break;
    }
    case 'markdown': {
      if (!options.target) fail(CLI_MESSAGES.image.targetRequiredForMarkdownMode);
      const token = createMarkdownToken(sanitizeMarkdownInput(options.alt), sourceForPatch);
      patchMarkdown(ast, options.target, token);
      break;
    }
    default:
      fail(CLI_MESSAGES.image.unsupportedMode(options.mode));
  }

  const output = generate(ast, { retainLines: true, retainFunctionParens: true }).code;

  const tmpPath = `${filePath}.${Date.now()}.tmp`;
  await writeFile(tmpPath, output, 'utf-8');
  await rename(tmpPath, filePath);

  console.log(JSON.stringify({
    status: 'ok',
    file: path.relative(process.cwd(), filePath),
    mode: options.mode,
    target: options.target || null,
    source: sourceLabel,
    assetPath: sourceForPatch,
  }, null, 2));
}

function sanitizeBaseName(raw: string): string {
  const normalized = raw
    .toLowerCase()
    .replace(/[^\w-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || 'image';
}
