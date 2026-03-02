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
