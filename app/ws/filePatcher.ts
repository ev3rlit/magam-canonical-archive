/**
 * AST-based file patcher for bidirectional editing
 */

import { readFile, writeFile } from 'fs/promises';
import { parse } from '@babel/parser';
import traverse, { NodePath } from '@babel/traverse';
import generate from '@babel/generator';
import * as t from '@babel/types';
import { getJsxTagStyleEditableKeys } from '@/features/editing/editability';
import { RPC_ERRORS } from './rpc';

export interface NodeProps {
    id?: string;
    from?: string | { node: string; edge?: Record<string, unknown> };
    to?: string;
    anchor?: string;
    position?: string;
    gap?: number;
    content?: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    pattern?: Record<string, unknown>;
    at?: Record<string, unknown>;
    shape?: 'rectangle' | 'heart' | 'cloud' | 'speech';
    [key: string]: unknown;
}

export interface CreateNodeInput {
    id: string;
    type: 'shape' | 'text' | 'markdown' | 'mindmap' | 'sticky' | 'sticker' | 'washi-tape' | 'image';
    props?: Record<string, unknown>;
    placement?: (
        | { mode: 'canvas-absolute'; x: number; y: number }
        | { mode: 'mindmap-child'; parentId: string }
        | { mode: 'mindmap-sibling'; siblingOf: string; parentId: string | null }
    );
}

function buildRpcLikeError(
    template: { code: number; message: string },
    data?: unknown,
): Error & { code: number; data?: unknown } {
    const error = new Error(template.message) as Error & { code: number; data?: unknown };
    error.code = template.code;
    if (data !== undefined) {
        error.data = data;
    }
    return error;
}

function throwContentContractViolation(detail: string): never {
    throw buildRpcLikeError(RPC_ERRORS.CONTENT_CONTRACT_VIOLATION, {
        path: 'capabilities.content',
        diagnostics: {
            path: 'capabilities.content',
            message: detail,
        },
    });
}

function assertContentContractPatchAllowed(
    tagName: string | null,
    patch: Record<string, unknown>,
): void {
    if ((tagName === 'Image' || tagName === 'Sequence') && 'content' in patch) {
        throwContentContractViolation(
            `${tagName} nodes do not accept string content patches; use their declared content contract.`,
        );
    }

    if (tagName !== 'Image' && ('src' in patch || 'alt' in patch || 'fit' in patch)) {
        throwContentContractViolation('media content fields are only valid for Image nodes.');
    }

    if (tagName !== 'Markdown' && 'source' in patch) {
        throwContentContractViolation('markdown source fields are only valid for Markdown nodes.');
    }

    if (tagName !== 'Sequence' && ('participants' in patch || 'messages' in patch)) {
        throwContentContractViolation('sequence content fields are only valid for Sequence nodes.');
    }
}

function getJsxTagName(node: t.JSXOpeningElement): string | null {
    return t.isJSXIdentifier(node.name) ? node.name.name : null;
}

function collectIdOccurrences(ast: t.File): Map<string, number> {
    const counts = new Map<string, number>();

    traverse(ast, {
        JSXOpeningElement(path: NodePath<t.JSXOpeningElement>) {
            const idValue = getStringLikeAttributeValue(getAttrByName(path.node, 'id'));
            if (!idValue) return;
            counts.set(idValue, (counts.get(idValue) || 0) + 1);
        },
    });

    return counts;
}

function findIdCollisionsInAst(ast: t.File): string[] {
    return Array.from(collectIdOccurrences(ast).entries())
        .filter(([, count]) => count > 1)
        .map(([id]) => id);
}

export async function getGlobalIdentifierCollisions(filePath: string): Promise<string[]> {
    const code = await readFile(filePath, 'utf-8');
    const ast = parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
    });
    return findIdCollisionsInAst(ast);
}

function hasConflictingNodeId(ast: t.File, nextId: string, currentNodeId: string): boolean {
    let conflictFound = false;

    traverse(ast, {
        JSXOpeningElement(path: NodePath<t.JSXOpeningElement>) {
            if (conflictFound) {
                path.stop();
                return;
            }
            const idValue = getStringLikeAttributeValue(getAttrByName(path.node, 'id'));
            if (!idValue) return;
            if (idValue === nextId && idValue !== currentNodeId) {
                conflictFound = true;
                path.stop();
            }
        },
    });

    return conflictFound;
}

function getAttrByName(node: t.JSXOpeningElement, name: string): t.JSXAttribute | undefined {
    return node.attributes.find(
        (attr: t.JSXAttribute | t.JSXSpreadAttribute): attr is t.JSXAttribute =>
            t.isJSXAttribute(attr) && t.isJSXIdentifier(attr.name) && attr.name.name === name,
    );
}

function getStringLikeAttributeValue(attr: t.JSXAttribute | undefined): string | null {
    const value = getAttributeValue(attr);
    return typeof value === 'string' ? value : null;
}

function expressionToValue(expression: t.Expression): unknown {
    if (t.isStringLiteral(expression)) return expression.value;
    if (t.isNumericLiteral(expression)) return expression.value;
    if (t.isBooleanLiteral(expression)) return expression.value;
    if (t.isNullLiteral(expression)) return null;
    if (t.isIdentifier(expression) && expression.name === 'undefined') return undefined;
    if (t.isArrayExpression(expression)) {
        const values: unknown[] = [];
        for (const item of expression.elements) {
            if (!item) {
                values.push(undefined);
                continue;
            }
            if (t.isSpreadElement(item)) return undefined;
            values.push(expressionToValue(item));
        }
        return values;
    }
    if (t.isObjectExpression(expression)) {
        const obj: Record<string, unknown> = {};
        for (const prop of expression.properties) {
            if (!t.isObjectProperty(prop) || prop.computed || t.isSpreadElement(prop)) return undefined;
            const key = t.isIdentifier(prop.key)
                ? prop.key.name
                : t.isStringLiteral(prop.key)
                    ? prop.key.value
                    : null;
            if (!key || !t.isExpression(prop.value)) return undefined;
            obj[key] = expressionToValue(prop.value);
        }
        return obj;
    }
    return undefined;
}

function getAttributeValue(attr: t.JSXAttribute | undefined): unknown {
    if (!attr) return undefined;
    const value = attr.value;
    if (!value) return true;
    if (t.isStringLiteral(value)) return value.value;
    if (t.isJSXExpressionContainer(value)) {
        if (t.isJSXEmptyExpression(value.expression)) return undefined;
        return expressionToValue(value.expression);
    }
    return undefined;
}

function getFromNodeReference(attr: t.JSXAttribute | undefined): string | null {
    const value = getAttributeValue(attr);
    if (typeof value === 'string') return value;
    if (value && typeof value === 'object') {
        const maybeNode = (value as Record<string, unknown>).node;
        return typeof maybeNode === 'string' ? maybeNode : null;
    }
    return null;
}

function getNodeByIdOpeningElement(ast: t.File, nodeId: string): NodePath<t.JSXOpeningElement> | null {
    let target: NodePath<t.JSXOpeningElement> | null = null;

    traverse(ast, {
        JSXOpeningElement(path: NodePath<t.JSXOpeningElement>) {
            if (target) {
                path.skip();
                return;
            }

            const idValue = getStringLikeAttributeValue(getAttrByName(path.node, 'id'));
            if (idValue === nodeId) {
                target = path;
            }
        },
    });

    return target;
}

function ensureNoSpreadAttributes(node: t.JSXOpeningElement): void {
    const hasSpread = node.attributes.some((attr) => t.isJSXSpreadAttribute(attr));
    if (hasSpread) {
        throw new Error('EDIT_NOT_ALLOWED');
    }
}

function setMarkdownChildContent(parentEl: NodePath<t.JSXElement>, content: string): boolean {
    const markdownChild = parentEl.node.children.find((child: t.JSXElement | t.JSXText | t.JSXExpressionContainer | t.JSXSpreadChild | t.JSXFragment): child is t.JSXElement =>
        t.isJSXElement(child) &&
        t.isJSXOpeningElement(child.openingElement) &&
        t.isJSXIdentifier(child.openingElement.name) &&
        child.openingElement.name.name === 'Markdown',
    );

    if (!markdownChild) {
        return false;
    }

    markdownChild.children = [
        t.jsxExpressionContainer(
            t.templateLiteral([t.templateElement({ raw: content, cooked: content }, true)], []),
        ),
    ];
    return true;
}

function setTextChildContent(parentEl: NodePath<t.JSXElement>, content: string): void {
    const hasComplexChildren = parentEl.node.children.some((child) => {
        if (t.isJSXText(child)) {
            return false;
        }
        if (t.isJSXExpressionContainer(child) && !t.isJSXEmptyExpression(child.expression)) {
            return true;
        }
        if (t.isJSXElement(child)) {
            return true;
        }
        return false;
    });

    if (hasComplexChildren) {
        throw new Error('EDIT_NOT_ALLOWED');
    }

    parentEl.node.children = [t.jsxText(content)];
}

function patchNodeRenameInAst(ast: t.File, nodeId: string, nextId: string): void {
    traverse(ast, {
        JSXOpeningElement(path: NodePath<t.JSXOpeningElement>) {
            const opening = path.node;
            ['from', 'to', 'anchor'].forEach((key) => {
                const attr = getAttrByName(opening, key);
                if (!attr) return;

                if (key === 'from') {
                    const value = getAttributeValue(attr);
                    if (typeof value === 'string') {
                        if (value === nodeId) {
                            upsertJsxAttribute(path as NodePath<t.JSXOpeningElement>, key, nextId);
                        }
                        return;
                    }
                    if (value && typeof value === 'object') {
                        const fromObject = value as Record<string, unknown>;
                        if (fromObject.node === nodeId) {
                            upsertJsxAttribute(path as NodePath<t.JSXOpeningElement>, key, {
                                ...fromObject,
                                node: nextId,
                            });
                        }
                    }
                    return;
                }

                const value = getStringLikeAttributeValue(attr);
                if (value === nodeId) {
                    upsertJsxAttribute(path as NodePath<t.JSXOpeningElement>, key, nextId);
                }
            });
        },
    });
}

function findOwningContainerForNodeId(ast: t.File, nodeId: string): NodePath<t.JSXElement> | null {
    const opening = getNodeByIdOpeningElement(ast, nodeId);
    if (!opening) {
        return null;
    }

    let current: NodePath<t.Node> | null = opening.parentPath;
    while (current) {
        if (current.isJSXElement()) {
            const tagName = getJsxTagName(current.node.openingElement);
            if (tagName === 'Canvas' || tagName === 'MindMap') {
                return current;
            }
        }
        current = current.parentPath;
    }

    return null;
}

function findFirstCanvasOrMindMap(ast: t.File): NodePath<t.JSXElement> | null {
    let target: NodePath<t.JSXElement> | null = null;

    traverse(ast, {
        JSXElement(path: NodePath<t.JSXElement>) {
            if (target) {
                path.stop();
                return;
            }
            const tagName = getJsxTagName(path.node.openingElement);
            if (tagName === 'Canvas' || tagName === 'MindMap') {
                target = path;
                path.stop();
            }
        },
    });

    return target;
}

function appendElementToContainer(
    container: NodePath<t.JSXElement>,
    element: t.JSXElement,
): void {
    container.node.children.push(t.jsxText('\n'), element, t.jsxText('\n'));
}

function toJsxAttributeExpression(value: unknown): t.Expression {
    if (value === null) {
        return t.nullLiteral();
    }
    if (value === undefined) {
        return t.identifier('undefined');
    }
    if (typeof value === 'number') {
        return t.numericLiteral(value);
    }
    if (typeof value === 'boolean') {
        return t.booleanLiteral(value);
    }
    if (typeof value === 'string') {
        return t.stringLiteral(value);
    }
    if (Array.isArray(value)) {
        return t.arrayExpression(value.map((item) => toJsxAttributeExpression(item)));
    }
    if (value && typeof value === 'object') {
        return t.objectExpression(
            Object.entries(value as Record<string, unknown>)
                .filter(([, nestedValue]) => nestedValue !== undefined)
                .map(([key, nestedValue]) => {
                    const objectKey = t.isValidIdentifier(key)
                        ? t.identifier(key)
                        : t.stringLiteral(key);
                    return t.objectProperty(objectKey, toJsxAttributeExpression(nestedValue));
                }),
        );
    }
    return t.stringLiteral(String(value));
}

function upsertJsxAttribute(path: NodePath<t.JSXOpeningElement>, propName: string, propValue: unknown) {
    const existingAttrIndex = path.node.attributes.findIndex(
        (attr: t.JSXAttribute | t.JSXSpreadAttribute): attr is t.JSXAttribute =>
            t.isJSXAttribute(attr) && t.isJSXIdentifier(attr.name) && attr.name.name === propName,
    );

    if (propValue === undefined || propValue === null) {
        if (existingAttrIndex >= 0) {
            path.node.attributes.splice(existingAttrIndex, 1);
        }
        return;
    }

    const newValue = t.jsxExpressionContainer(toJsxAttributeExpression(propValue));

    if (existingAttrIndex >= 0) {
        const existingAttr = path.node.attributes[existingAttrIndex] as t.JSXAttribute;
        existingAttr.value = newValue;
    } else {
        path.node.attributes.push(t.jsxAttribute(t.jsxIdentifier(propName), newValue));
    }
}

function toJsxChildren(type: CreateNodeInput['type'], props: Record<string, unknown>): t.JSXElement['children'] {
    const content = props.content;
    if (type === 'markdown') {
        if (typeof content === 'string') {
            return [
                t.jsxElement(
                    t.jsxOpeningElement(t.jsxIdentifier('Markdown'), [], false),
                    t.jsxClosingElement(t.jsxIdentifier('Markdown')),
                    [t.jsxExpressionContainer(t.templateLiteral([t.templateElement({ raw: content, cooked: content }, true)], []))],
                    false,
                ),
            ];
        }
        return [];
    }

    if (typeof content === 'string' && content.length > 0) {
        return [t.jsxText(content)];
    }

    return [];
}

function buildNodeElement(input: CreateNodeInput): t.JSXElement {
    const placement = input.placement;
    const placementMode = placement?.mode;
    const placementProps =
        placement && placementMode === 'canvas-absolute'
            ? { x: placement.x, y: placement.y }
            : placement && placementMode === 'mindmap-child'
                ? { from: placement.parentId }
                : placement && placementMode === 'mindmap-sibling'
                    ? { ...(placement.parentId ? { from: placement.parentId } : {}) }
                    : {};
    const tag = placementMode === 'mindmap-child' || placementMode === 'mindmap-sibling'
        ? 'Node'
        : input.type === 'mindmap'
        ? 'MindMap'
        : input.type === 'shape'
            ? 'Shape'
            : input.type === 'text'
                ? 'Text'
                : input.type === 'image'
                    ? 'Image'
                    : input.type === 'sticky'
                        ? 'Sticky'
        : input.type === 'sticker'
            ? 'Sticker'
            : input.type === 'washi-tape'
                ? 'WashiTape'
            : 'Node';
    const props = { ...(input.props || {}), ...placementProps, id: input.id };
    const attrs = Object.entries(props)
        .filter(([key, value]) => key !== 'content' && value !== undefined && value !== null)
        .map(([key, value]) =>
            t.jsxAttribute(t.jsxIdentifier(key), t.jsxExpressionContainer(toJsxAttributeExpression(value))),
        );

    return t.jsxElement(
        t.jsxOpeningElement(t.jsxIdentifier(tag), attrs, false),
        t.jsxClosingElement(t.jsxIdentifier(tag)),
        toJsxChildren(input.type, props),
        false,
    );
}

function buildMindMapAdjacency(ast: t.File): Map<string, string[]> {
    const childrenByParent = new Map<string, string[]>();

    traverse(ast, {
        JSXOpeningElement(path: NodePath<t.JSXOpeningElement>) {
            const node = path.node;
            if (!t.isJSXIdentifier(node.name)) return;
            const id = getStringLikeAttributeValue(getAttrByName(node, 'id'));
            const from = getFromNodeReference(getAttrByName(node, 'from'));
            if (!id || !from) return;
            const list = childrenByParent.get(from) || [];
            list.push(id);
            childrenByParent.set(from, list);
        },
    });

    return childrenByParent;
}

function wouldCreateCycle(ast: t.File, nodeId: string, newParentId: string): boolean {
    if (nodeId === newParentId) return true;

    const graph = buildMindMapAdjacency(ast);
    const stack = [nodeId];
    const visited = new Set<string>();

    while (stack.length > 0) {
        const current = stack.pop()!;
        if (visited.has(current)) continue;
        visited.add(current);

        const children = graph.get(current) || [];
        for (const child of children) {
            if (child === newParentId) {
                return true;
            }
            stack.push(child);
        }
    }

    return false;
}

async function patchWithMutator(filePath: string, mutator: (ast: t.File) => boolean): Promise<void> {
    const code = await readFile(filePath, 'utf-8');
    const ast = parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
    });

    const found = mutator(ast);

    if (!found) {
        throw new Error('NODE_NOT_FOUND');
    }

    const output = generate(ast, {
        retainLines: true,
        retainFunctionParens: true,
    });

    await writeFile(filePath, output.code, 'utf-8');
}

export async function patchFile(filePath: string, nodeId: string, props: NodeProps): Promise<void> {
    await patchWithMutator(filePath, (ast) => {
        const node = getNodeByIdOpeningElement(ast, nodeId);
        if (!node) return false;

        const tagName = getJsxTagName(node.node);
        const nextId = typeof props.id === 'string' ? props.id : undefined;
        if (nextId && nextId !== nodeId && hasConflictingNodeId(ast, nextId, nodeId)) {
            throw new Error('ID_COLLISION');
        }
        const patchProps: Record<string, unknown> = { ...props };
        assertContentContractPatchAllowed(tagName, patchProps);
        delete patchProps.content;

        Object.entries(patchProps).forEach(([propName, propValue]) => {
            if (propName === 'at' && propValue && typeof propValue === 'object') {
                const existingAt = getAttributeValue(getAttrByName(node.node, 'at'));
                if (existingAt && typeof existingAt === 'object') {
                    upsertJsxAttribute(node, propName, {
                        ...(existingAt as Record<string, unknown>),
                        ...(propValue as Record<string, unknown>),
                    });
                    return;
                }
            }
            upsertJsxAttribute(node, propName, propValue);
        });

        if (typeof props.content === 'string') {
            const parentEl = node.parentPath;
            if (parentEl && parentEl.isJSXElement()) {
                if (!setMarkdownChildContent(parentEl, props.content)) {
                    parentEl.node.children = [t.jsxText(props.content)];
                }
            }
        }

        if (nextId && nextId !== nodeId) {
            patchNodeRenameInAst(ast, nodeId, nextId);
        }

        return true;
    });
}

export async function patchNodePosition(filePath: string, nodeId: string, x: number, y: number): Promise<void> {
    await patchWithMutator(filePath, (ast) => {
        const node = getNodeByIdOpeningElement(ast, nodeId);
        if (!node) return false;
        upsertJsxAttribute(node, 'x', x);
        upsertJsxAttribute(node, 'y', y);
        return true;
    });
}

export async function patchNodeRelativePosition(
    filePath: string,
    nodeId: string,
    props: Pick<NodeProps, 'gap' | 'at'>,
): Promise<void> {
    await patchWithMutator(filePath, (ast) => {
        const node = getNodeByIdOpeningElement(ast, nodeId);
        if (!node) return false;

        ensureNoSpreadAttributes(node.node);
        const propKeys = Object.keys(props);
        if (propKeys.some((key) => key !== 'gap' && key !== 'at')) {
            throw new Error('EDIT_NOT_ALLOWED');
        }
        const hasGap = typeof props.gap === 'number';
        const nextAt = props.at;
        const offset = nextAt && typeof nextAt === 'object'
            ? (nextAt as Record<string, unknown>).offset
            : undefined;
        const hasOffset = typeof offset === 'number';
        if (nextAt && typeof nextAt === 'object') {
            const nextAtKeys = Object.keys(nextAt as Record<string, unknown>);
            if (nextAtKeys.some((key) => key !== 'offset')) {
                throw new Error('EDIT_NOT_ALLOWED');
            }
        }

        if (!hasGap && !hasOffset) {
            throw new Error('EDIT_NOT_ALLOWED');
        }

        if (hasGap) {
            upsertJsxAttribute(node, 'gap', props.gap);
        }

        if (hasOffset) {
            const existingAt = getAttributeValue(getAttrByName(node.node, 'at'));
            if (!existingAt || typeof existingAt !== 'object') {
                throw new Error('EDIT_NOT_ALLOWED');
            }

            upsertJsxAttribute(node, 'at', {
                ...(existingAt as Record<string, unknown>),
                offset,
            });
        }

        return true;
    });
}

export async function patchNodeContent(filePath: string, nodeId: string, content: string): Promise<void> {
    await patchWithMutator(filePath, (ast) => {
        const node = getNodeByIdOpeningElement(ast, nodeId);
        if (!node) return false;

        ensureNoSpreadAttributes(node.node);
        const tagName = getJsxTagName(node.node);
        assertContentContractPatchAllowed(tagName, { content });
        const labelAttr = getAttrByName(node.node, 'label');
        if (labelAttr) {
            const currentLabel = getAttributeValue(labelAttr);
            if (currentLabel === undefined) {
                throw new Error('EDIT_NOT_ALLOWED');
            }
            upsertJsxAttribute(node, 'label', content);
            return true;
        }

        const parentEl = node.parentPath;
        if (!parentEl || !parentEl.isJSXElement()) {
            throw new Error('EDIT_NOT_ALLOWED');
        }

        if (setMarkdownChildContent(parentEl, content)) {
            return true;
        }

        setTextChildContent(parentEl, content);
        return true;
    });
}

export async function patchNodeStyle(filePath: string, nodeId: string, patch: Record<string, unknown>): Promise<void> {
    await patchWithMutator(filePath, (ast) => {
        const node = getNodeByIdOpeningElement(ast, nodeId);
        if (!node) return false;

        ensureNoSpreadAttributes(node.node);
        const tagName = getJsxTagName(node.node);
        assertContentContractPatchAllowed(tagName, patch);
        const editableKeys = getJsxTagStyleEditableKeys(tagName || undefined);
        if (editableKeys.length === 0) {
            throw new Error('EDIT_NOT_ALLOWED');
        }

        const allowedKeySet = new Set(editableKeys);
        const patchEntries = Object.entries(patch);
        if (patchEntries.length === 0) {
            throw new Error('EDIT_NOT_ALLOWED');
        }

        for (const [key, value] of patchEntries) {
            if (!allowedKeySet.has(key)) {
                throw new Error('EDIT_NOT_ALLOWED');
            }
            upsertJsxAttribute(node, key, value);
        }

        return true;
    });
}

export async function patchNodeRename(filePath: string, nodeId: string, nextId: string): Promise<void> {
    await patchWithMutator(filePath, (ast) => {
        const node = getNodeByIdOpeningElement(ast, nodeId);
        if (!node) return false;

        ensureNoSpreadAttributes(node.node);
        if (hasConflictingNodeId(ast, nextId, nodeId)) {
            throw new Error('ID_COLLISION');
        }

        upsertJsxAttribute(node, 'id', nextId);
        patchNodeRenameInAst(ast, nodeId, nextId);
        return true;
    });
}

export async function patchNodeCreate(filePath: string, input: CreateNodeInput): Promise<void> {
    await patchWithMutator(filePath, (ast) => {
        if (hasConflictingNodeId(ast, input.id, '')) {
            throw new Error('ID_COLLISION');
        }

        const newElement = buildNodeElement(input);
        const placement = input.placement;
        const placementMode = placement?.mode;

        if (placement && placementMode === 'mindmap-child') {
            const container = findOwningContainerForNodeId(ast, placement.parentId);
            if (!container) {
                return false;
            }
            appendElementToContainer(container, newElement);
            return true;
        }

        if (placement && placementMode === 'mindmap-sibling') {
            const container = findOwningContainerForNodeId(ast, placement.siblingOf);
            if (!container) {
                return false;
            }
            appendElementToContainer(container, newElement);
            return true;
        }

        const container = findFirstCanvasOrMindMap(ast);
        if (!container) {
            return false;
        }
        appendElementToContainer(container, newElement);
        return true;
    });
}

export async function patchNodeReparent(filePath: string, nodeId: string, newParentId: string | null): Promise<void> {
    const code = await readFile(filePath, 'utf-8');
    const ast = parse(code, { sourceType: 'module', plugins: ['jsx', 'typescript'] });

    const node = getNodeByIdOpeningElement(ast, nodeId);
    if (!node) throw new Error('NODE_NOT_FOUND');
    const nodeContainer = findOwningContainerForNodeId(ast, nodeId);
    if (!nodeContainer) throw new Error('NODE_NOT_FOUND');

    if (newParentId) {
        const newParent = getNodeByIdOpeningElement(ast, newParentId);
        if (!newParent) {
            throw new Error('NODE_NOT_FOUND');
        }
        const parentContainer = findOwningContainerForNodeId(ast, newParentId);
        if (!parentContainer || parentContainer.node !== nodeContainer.node) {
            throw new Error('EDIT_NOT_ALLOWED');
        }
        if (wouldCreateCycle(ast, nodeId, newParentId)) {
            throw new Error('MINDMAP_CYCLE');
        }
    }

    if (newParentId === null) {
        upsertJsxAttribute(node, 'from', null);
    } else {
        const currentFromValue = getAttributeValue(getAttrByName(node.node, 'from'));
        if (currentFromValue && typeof currentFromValue === 'object') {
            const currentFromObject = currentFromValue as Record<string, unknown>;
            upsertJsxAttribute(node, 'from', {
                ...currentFromObject,
                node: newParentId,
            });
        } else {
            upsertJsxAttribute(node, 'from', newParentId);
        }
    }

    const output = generate(ast, { retainLines: true, retainFunctionParens: true });
    await writeFile(filePath, output.code, 'utf-8');
}

export async function patchNodeDelete(filePath: string, nodeId: string): Promise<void> {
    await patchWithMutator(filePath, (ast) => {
        const node = getNodeByIdOpeningElement(ast, nodeId);
        if (!node) {
            return false;
        }

        const elementPath = node.parentPath;
        if (!elementPath || !elementPath.isJSXElement()) {
            throw new Error('EDIT_NOT_ALLOWED');
        }

        const containerPath = elementPath.parentPath;
        if (!containerPath || !containerPath.isJSXElement()) {
            throw new Error('EDIT_NOT_ALLOWED');
        }

        const targetIndex = containerPath.node.children.findIndex((child) => child === elementPath.node);
        if (targetIndex < 0) {
            throw new Error('NODE_NOT_FOUND');
        }

        containerPath.node.children.splice(targetIndex, 1);
        return true;
    });
}
