'use client';

import clsx from 'clsx';
import { EditorContent, useEditor } from '@tiptap/react';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';
import TaskItem from '@tiptap/extension-task-item';
import TaskList from '@tiptap/extension-task-list';
import StarterKit from '@tiptap/starter-kit';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { useEditorStore } from '@/core/editor/model/editor-store';
import type { EditorCanvasObject } from '@/core/editor/model/editor-types';
import {
  getNodePlainText,
  type EditorBodyDocument,
  type EditorBodyNode,
} from '@/core/editor/model/editor-body';
import {
  CanvasActiveBlockDecoration,
  CanvasBodyClipboardNormalizer,
  CanvasSlashCommand,
  canvasSlashCommandKey,
  type CanvasSlashState,
} from './body-editor-extensions';

interface SlashAction {
  id: string;
  label: string;
  apply: () => void;
}

function renderBodyNode(node: EditorBodyNode, key: string): ReactNode {
  switch (node.type) {
    case 'paragraph':
      return <p key={key}>{node.content?.map((child, index) => renderBodyNode(child, `${key}-${index}`))}</p>;
    case 'text':
      return node.text ?? '';
    case 'heading': {
      const level = Number(node.attrs?.['level'] ?? 1);
      if (level === 1) {
        return <h1 key={key}>{node.content?.map((child, index) => renderBodyNode(child, `${key}-${index}`))}</h1>;
      }
      if (level === 2) {
        return <h2 key={key}>{node.content?.map((child, index) => renderBodyNode(child, `${key}-${index}`))}</h2>;
      }
      return <h3 key={key}>{node.content?.map((child, index) => renderBodyNode(child, `${key}-${index}`))}</h3>;
    }
    case 'bulletList':
      return <ul key={key}>{node.content?.map((child, index) => renderBodyNode(child, `${key}-${index}`))}</ul>;
    case 'orderedList':
      return <ol key={key}>{node.content?.map((child, index) => renderBodyNode(child, `${key}-${index}`))}</ol>;
    case 'taskList':
      return <ul className="canvas-body-preview__task-list" key={key}>{node.content?.map((child, index) => renderBodyNode(child, `${key}-${index}`))}</ul>;
    case 'listItem':
      return <li key={key}>{node.content?.map((child, index) => renderBodyNode(child, `${key}-${index}`))}</li>;
    case 'taskItem':
      return (
        <li className="canvas-body-preview__task-item" key={key}>
          <input checked={Boolean(node.attrs?.['checked'])} readOnly type="checkbox" />
          <span>{node.content?.map((child, index) => renderBodyNode(child, `${key}-${index}`))}</span>
        </li>
      );
    case 'blockquote':
      return <blockquote key={key}>{node.content?.map((child, index) => renderBodyNode(child, `${key}-${index}`))}</blockquote>;
    case 'codeBlock':
      return <pre key={key}><code>{getNodePlainText(node)}</code></pre>;
    case 'horizontalRule':
      return <hr key={key} />;
    case 'image':
      return (
        <figure className="canvas-object__image-block" key={key}>
          <img
            alt={typeof node.attrs?.['alt'] === 'string' ? node.attrs['alt'] : 'Canvas image block'}
            className="canvas-object__image"
            src={typeof node.attrs?.['src'] === 'string' ? node.attrs['src'] : ''}
          />
          {typeof node.attrs?.['alt'] === 'string' && node.attrs['alt'].length > 0
            ? <figcaption>{node.attrs['alt']}</figcaption>
            : null}
        </figure>
      );
    default:
      return null;
  }
}

function BodyPreview({ body }: { body: EditorBodyDocument }) {
  return (
    <div className="canvas-body-preview">
      {body.content.map((node, index) => (
        <div className="canvas-body-preview__node" key={`node-${index}`}>
          {renderBodyNode(node, `node-${index}`)}
        </div>
      ))}
    </div>
  );
}

function BodyEditor({
  body,
  objectId,
}: {
  body: EditorBodyDocument;
  objectId: string;
}) {
  const closeBodyEditor = useEditorStore((state) => state.closeBodyEditor);
  const consumeBodyEditorPendingText = useEditorStore((state) => state.consumeBodyEditorPendingText);
  const updateObjectBody = useEditorStore((state) => state.updateObjectBody);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [slashState, setSlashState] = useState<CanvasSlashState | null>(null);
  const [slashIndex, setSlashIndex] = useState(0);
  const [slashAnchor, setSlashAnchor] = useState<{ left: number; top: number } | null>(null);
  const [pendingImageOpen, setPendingImageOpen] = useState(false);
  const [imageDraft, setImageDraft] = useState({ src: '', alt: '' });
  const initialRef = useRef(JSON.stringify(body));

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Placeholder.configure({
        placeholder: 'Type to write, or / for blocks',
      }),
      Image,
      TaskList,
      TaskItem.configure({ nested: false }),
      CanvasSlashCommand,
      CanvasActiveBlockDecoration,
      CanvasBodyClipboardNormalizer,
    ],
    content: body,
    autofocus: 'end',
    editorProps: {
      attributes: {
        class: 'canvas-object__wysiwyg-surface',
        'aria-label': 'Document body editor',
      },
      handleKeyDown: (_view, event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          (event.target as HTMLElement | null)?.blur();
          return true;
        }
        return false;
      },
    },
    onSelectionUpdate: ({ editor: currentEditor }) => {
      const state = canvasSlashCommandKey.getState(currentEditor.state) ?? null;
      setSlashState(state?.active ? state : null);
      if (!state?.active) {
        setSlashIndex(0);
      }
    },
    onUpdate: ({ editor: currentEditor }) => {
      const state = canvasSlashCommandKey.getState(currentEditor.state) ?? null;
      setSlashState(state?.active ? state : null);
      if (!state?.active) {
        setSlashIndex(0);
      }
    },
  }, [body, objectId]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    const pendingText = consumeBodyEditorPendingText();
    if (!pendingText) {
      return;
    }

    editor.commands.focus('end');
    if (pendingText === '\n') {
      editor.commands.enter();
      return;
    }
    editor.commands.insertContent(pendingText);
  }, [consumeBodyEditorPendingText, editor]);

  useEffect(() => {
    if (!editor || !slashState?.active || !wrapperRef.current) {
      setSlashAnchor(null);
      return;
    }

    const coords = editor.view.coordsAtPos(slashState.from);
    const rect = wrapperRef.current.getBoundingClientRect();
    setSlashAnchor({
      left: coords.left - rect.left,
      top: coords.bottom - rect.top + 8,
    });
  }, [editor, slashState]);

  const commitIfNeeded = () => {
    if (!editor) {
      return;
    }

    const nextBody = editor.getJSON() as EditorBodyDocument;
    const nextSerialized = JSON.stringify(nextBody);
    if (nextSerialized !== initialRef.current) {
      updateObjectBody(objectId, nextBody);
      initialRef.current = nextSerialized;
      return;
    }

    closeBodyEditor();
  };

  const syncDomIntoEditor = () => {
    if (!editor || !wrapperRef.current) {
      return;
    }

    const surface = wrapperRef.current.querySelector('.canvas-object__wysiwyg-surface');
    if (!(surface instanceof HTMLElement)) {
      return;
    }

    const domHtml = surface.innerHTML.trim();
    if (domHtml.length === 0) {
      return;
    }

    const editorHtml = editor.getHTML().trim();
    if (domHtml === editorHtml) {
      return;
    }

    editor.commands.setContent(domHtml, {
      contentType: 'html',
    });
  };

  const slashActions = useMemo<SlashAction[]>(() => {
    if (!editor || !slashState?.active) {
      return [];
    }

    const deleteSlash = () => editor.chain().focus().deleteRange({ from: slashState.from, to: slashState.to }).run();

    return [
      { id: 'text', label: 'Text', apply: () => { deleteSlash(); editor.chain().focus().setParagraph().run(); } },
      { id: 'h1', label: 'Heading 1', apply: () => { deleteSlash(); editor.chain().focus().toggleHeading({ level: 1 }).run(); } },
      { id: 'h2', label: 'Heading 2', apply: () => { deleteSlash(); editor.chain().focus().toggleHeading({ level: 2 }).run(); } },
      { id: 'h3', label: 'Heading 3', apply: () => { deleteSlash(); editor.chain().focus().toggleHeading({ level: 3 }).run(); } },
      { id: 'bulleted', label: 'Bulleted List', apply: () => { deleteSlash(); editor.chain().focus().toggleBulletList().run(); } },
      { id: 'numbered', label: 'Numbered List', apply: () => { deleteSlash(); editor.chain().focus().toggleOrderedList().run(); } },
      { id: 'checklist', label: 'Checklist', apply: () => { deleteSlash(); editor.chain().focus().toggleTaskList().run(); } },
      { id: 'quote', label: 'Quote', apply: () => { deleteSlash(); editor.chain().focus().toggleBlockquote().run(); } },
      { id: 'code', label: 'Code Block', apply: () => { deleteSlash(); editor.chain().focus().toggleCodeBlock().run(); } },
      {
        id: 'divider',
        label: 'Divider',
        apply: () => {
          deleteSlash();
          editor.chain().focus().setHorizontalRule().createParagraphNear().run();
        },
      },
      {
        id: 'image',
        label: 'Image',
        apply: () => {
          deleteSlash();
          editor.chain().focus().insertContent([
            { type: 'image', attrs: { src: '', alt: '' } },
            { type: 'paragraph' },
          ]).run();
          setPendingImageOpen(true);
          setImageDraft({ src: '', alt: '' });
        },
      },
    ].filter((action) => action.label.toLowerCase().includes(slashState.query));
  }, [editor, slashState]);

  useEffect(() => {
    if (!slashActions.length) {
      setSlashIndex(0);
      return;
    }
    setSlashIndex((current) => Math.min(current, slashActions.length - 1));
  }, [slashActions]);

  const applySlashAction = (action: SlashAction) => {
    action.apply();
    setSlashState(null);
    setSlashAnchor(null);
    setSlashIndex(0);
  };

  const applyImageDraft = () => {
    if (!editor) {
      return;
    }

    const nextBody = editor.getJSON() as EditorBodyDocument;
    const imageIndex = [...nextBody.content].reverse().findIndex((node) => node.type === 'image');
    if (imageIndex < 0) {
      setPendingImageOpen(false);
      return;
    }

    const targetIndex = nextBody.content.length - 1 - imageIndex;
    const target = nextBody.content[targetIndex];
    if (!target) {
      setPendingImageOpen(false);
      return;
    }

    nextBody.content[targetIndex] = {
      ...target,
      attrs: {
        ...(target.attrs ?? {}),
        src: imageDraft.src,
        alt: imageDraft.alt,
      },
    };
    editor.commands.setContent(nextBody);
    setPendingImageOpen(false);
  };

  if (!editor) {
    return null;
  }

  return (
    <div
      className="canvas-object__wysiwyg"
      onBlur={(event) => {
        const nextTarget = event.relatedTarget;
        if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
          return;
        }
        syncDomIntoEditor();
        commitIfNeeded();
      }}
      onPointerDown={(event) => event.stopPropagation()}
      ref={wrapperRef}
    >
      <EditorContent
        editor={editor}
        onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
          if (!slashState?.active || slashActions.length === 0) {
            return;
          }

          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setSlashIndex((current) => (current + 1) % slashActions.length);
            return;
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault();
            setSlashIndex((current) => (current - 1 + slashActions.length) % slashActions.length);
            return;
          }
          if (event.key === 'Enter') {
            event.preventDefault();
            applySlashAction(slashActions[slashIndex] ?? slashActions[0]!);
            return;
          }
          if (event.key === 'Escape') {
            event.preventDefault();
            editor.chain().focus().deleteRange({ from: slashState.from, to: slashState.to }).run();
            setSlashState(null);
            setSlashAnchor(null);
          }
        }}
      />
      {slashState?.active && slashActions.length > 0 && slashAnchor ? (
        <div
          className="canvas-body-slash-menu"
          style={{ left: slashAnchor.left, top: slashAnchor.top }}
        >
          {slashActions.map((action, index) => (
            <button
              className={clsx('canvas-body-slash-menu__item', {
                'canvas-body-slash-menu__item--active': index === slashIndex,
              })}
              key={action.id}
              onMouseDown={(event) => {
                event.preventDefault();
                applySlashAction(action);
              }}
              type="button"
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
      {pendingImageOpen ? (
        <div className="canvas-body-image-panel">
          <label className="canvas-body-image-panel__field">
            <span>Image URL</span>
            <input
              autoFocus
              className="canvas-object__block-input"
              onChange={(event) => setImageDraft((current) => ({ ...current, src: event.target.value }))}
              value={imageDraft.src}
            />
          </label>
          <label className="canvas-body-image-panel__field">
            <span>Alt text</span>
            <input
              className="canvas-object__block-input"
              onChange={(event) => setImageDraft((current) => ({ ...current, alt: event.target.value }))}
              value={imageDraft.alt}
            />
          </label>
          <button className="canvas-body-image-panel__submit" onClick={applyImageDraft} type="button">
            Apply image
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function CanvasObjectBody({
  object,
  isSelected,
}: {
  object: EditorCanvasObject;
  isSelected: boolean;
}) {
  const activeBodyEditorObjectId = useEditorStore((state) => state.overlays.activeBodyEditorObjectId);
  const isBodyEditorOpen = useEditorStore((state) => state.overlays.isBodyEditorOpen);
  const openBodyEditor = useEditorStore((state) => state.openBodyEditor);

  const isEditing = isBodyEditorOpen && activeBodyEditorObjectId === object.id;

  return (
    <div
      className={clsx('canvas-object__content-stack', {
        'canvas-object__content-stack--editing': isEditing,
      })}
      onClick={(event) => {
        if (!isSelected || isEditing) {
          return;
        }
        event.stopPropagation();
        openBodyEditor(object.id);
      }}
      onPointerDown={(event: PointerEvent<HTMLDivElement>) => {
        if (!isSelected) {
          return;
        }
        event.stopPropagation();
      }}
    >
      {isEditing ? <BodyEditor body={object.body} objectId={object.id} /> : <BodyPreview body={object.body} />}
    </div>
  );
}
