/**
 * AST-based file patcher for bidirectional editing
 */

import { readFile, writeFile } from 'fs/promises';
import { parse } from '@babel/parser';
import traverse, { NodePath } from '@babel/traverse';
import generate from '@babel/generator';
import * as t from '@babel/types';

export interface NodeProps {
    id?: string;
    from?: string;
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
    type: 'shape' | 'text' | 'markdown' | 'mindmap' | 'sticker' | 'washi-tape';
    props?: Record<string, unknown>;
}

function getAttrByName(node: t.JSXOpeningElement, name: string): t.JSXAttribute | undefined {
    return node.attributes.find(
        (attr: t.JSXAttribute | t.JSXSpreadAttribute): attr is t.JSXAttribute =>
            t.isJSXAttribute(attr) && t.isJSXIdentifier(attr.name) && attr.name.name === name,
    );
}

function getStringLikeAttributeValue(attr: t.JSXAttribute | undefined): string | null {
    if (!attr) return null;
    const value = attr.value;
    if (!value) return null;
    if (t.isStringLiteral(value)) return value.value;
    if (t.isJSXExpressionContainer(value) && t.isStringLiteral(value.expression)) {
        return value.expression.value;
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
    const tag = input.type === 'mindmap'
        ? 'MindMap'
        : input.type === 'sticker'
            ? 'Sticky'
            : input.type === 'washi-tape'
                ? 'WashiTape'
            : 'Node';
    const props = { ...(input.props || {}), id: input.id };
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
            if (!t.isJSXIdentifier(node.name) || node.name.name !== 'Node') return;
            const id = getStringLikeAttributeValue(getAttrByName(node, 'id'));
            const from = getStringLikeAttributeValue(getAttrByName(node, 'from'));
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

        const nextId = typeof props.id === 'string' ? props.id : undefined;
        const patchProps: Record<string, unknown> = { ...props };
        delete patchProps.content;

        Object.entries(patchProps).forEach(([propName, propValue]) => {
            upsertJsxAttribute(node, propName, propValue);
        });

        if (typeof props.content === 'string') {
            const parentEl = node.parentPath;
            if (parentEl && parentEl.isJSXElement()) {
                const markdownChild = parentEl.node.children.find((child: t.JSXElement | t.JSXText | t.JSXExpressionContainer | t.JSXSpreadChild | t.JSXFragment): child is t.JSXElement =>
                    t.isJSXElement(child) &&
                    t.isJSXOpeningElement(child.openingElement) &&
                    t.isJSXIdentifier(child.openingElement.name) &&
                    child.openingElement.name.name === 'Markdown',
                );

                if (markdownChild) {
                    markdownChild.children = [
                        t.jsxExpressionContainer(
                            t.templateLiteral([t.templateElement({ raw: props.content, cooked: props.content }, true)], []),
                        ),
                    ];
                } else {
                    parentEl.node.children = [t.jsxText(props.content)];
                }
            }
        }

        if (nextId && nextId !== nodeId) {
            traverse(ast, {
                JSXOpeningElement(path: NodePath<t.JSXOpeningElement>) {
                    const opening = path.node;
                    ['from', 'to', 'anchor'].forEach((key) => {
                        const attr = getAttrByName(opening, key);
                        const value = getStringLikeAttributeValue(attr);
                        if (!attr || value !== nodeId) return;
                        upsertJsxAttribute(path as NodePath<t.JSXOpeningElement>, key, nextId);
                    });
                },
            });
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

export async function patchNodeCreate(filePath: string, input: CreateNodeInput): Promise<void> {
    const code = await readFile(filePath, 'utf-8');
    const ast = parse(code, { sourceType: 'module', plugins: ['jsx', 'typescript'] });

    let inserted = false;
    const newElement = buildNodeElement(input);

    traverse(ast, {
        JSXElement(path: NodePath<t.JSXElement>) {
            if (inserted) return;
            const opening = path.node.openingElement;
            if (!t.isJSXIdentifier(opening.name)) return;
            const tag = opening.name.name;
            if (tag !== 'Canvas' && tag !== 'MindMap') return;

            path.node.children.push(t.jsxText('\n'), newElement, t.jsxText('\n'));
            inserted = true;
            path.stop();
        },
    });

    if (!inserted) {
        throw new Error('NODE_NOT_FOUND');
    }

    const output = generate(ast, { retainLines: true, retainFunctionParens: true });
    await writeFile(filePath, output.code, 'utf-8');
}

export async function patchNodeReparent(filePath: string, nodeId: string, newParentId: string | null): Promise<void> {
    const code = await readFile(filePath, 'utf-8');
    const ast = parse(code, { sourceType: 'module', plugins: ['jsx', 'typescript'] });

    const node = getNodeByIdOpeningElement(ast, nodeId);
    if (!node) throw new Error('NODE_NOT_FOUND');

    if (newParentId && wouldCreateCycle(ast, nodeId, newParentId)) {
        throw new Error('MINDMAP_CYCLE');
    }

    upsertJsxAttribute(node, 'from', newParentId);

    const output = generate(ast, { retainLines: true, retainFunctionParens: true });
    await writeFile(filePath, output.code, 'utf-8');
}
