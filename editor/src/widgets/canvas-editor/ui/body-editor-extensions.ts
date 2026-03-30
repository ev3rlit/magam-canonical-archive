'use client';

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, TextSelection, type EditorState } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export interface CanvasSlashState {
  active: boolean;
  from: number;
  to: number;
  query: string;
}

export const canvasSlashCommandKey = new PluginKey<CanvasSlashState>('canvasSlashCommand');

function getSlashMatch(state: EditorState): CanvasSlashState | null {
  const { selection } = state;
  if (!selection.empty) {
    return null;
  }

  const $from = selection.$from;
  if (!$from.parent.isTextblock) {
    return null;
  }

  const textBefore = $from.parent.textBetween(0, $from.parentOffset, '\0', '\0');
  const slashIndex = textBefore.lastIndexOf('/');
  if (slashIndex < 0) {
    return null;
  }

  const prefix = textBefore.slice(0, slashIndex);
  if (prefix.length > 0 && !/\s$/.test(prefix)) {
    return null;
  }

  const rawQuery = textBefore.slice(slashIndex + 1);
  if (/\s/.test(rawQuery)) {
    return null;
  }

  const from = $from.start() + slashIndex;
  return {
    active: true,
    from,
    to: selection.from,
    query: rawQuery.toLowerCase(),
  };
}

export const CanvasSlashCommand = Extension.create({
  name: 'canvasSlashCommand',
  addProseMirrorPlugins() {
    return [
      new Plugin<CanvasSlashState>({
        key: canvasSlashCommandKey,
        state: {
          init: (_, state) => getSlashMatch(state) ?? {
            active: false,
            from: 0,
            to: 0,
            query: '',
          },
          apply: (_tr, _oldValue, _oldState, newState) => getSlashMatch(newState) ?? {
            active: false,
            from: 0,
            to: 0,
            query: '',
          },
        },
      }),
    ];
  },
});

export const CanvasActiveBlockDecoration = Extension.create({
  name: 'canvasActiveBlockDecoration',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('canvasActiveBlockDecoration'),
        props: {
          decorations(state) {
            const { selection } = state;
            if (!selection.empty && !(selection instanceof TextSelection)) {
              return DecorationSet.empty;
            }

            if (selection.$from.depth < 1) {
              return DecorationSet.empty;
            }

            const topLevelNode = selection.$from.node(1);
            const from = selection.$from.before(1);
            const to = from + topLevelNode.nodeSize;

            return DecorationSet.create(state.doc, [
              Decoration.node(from, to, {
                class: 'canvas-body-preview__node--active',
              }),
            ]);
          },
        },
      }),
    ];
  },
});

export const CanvasBodyClipboardNormalizer = Extension.create({
  name: 'canvasBodyClipboardNormalizer',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('canvasBodyClipboardNormalizer'),
        props: {
          handlePaste(view, event) {
            const plainText = event.clipboardData?.getData('text/plain');
            const html = event.clipboardData?.getData('text/html');
            if (!plainText || (html && html.length > 0)) {
              return false;
            }

            const normalized = plainText.replace(/\r\n/g, '\n');
            if (normalized === plainText) {
              return false;
            }

            event.preventDefault();
            view.dispatch(
              view.state.tr.insertText(normalized, view.state.selection.from, view.state.selection.to),
            );
            return true;
          },
        },
      }),
    ];
  },
});
