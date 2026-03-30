'use client';

import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import { useEffect, useRef } from 'react';

function normalizeMarkdown(source: string) {
  return source.trimEnd();
}

export function CanvasMarkdownWysiwygEditor({
  initialMarkdown,
  onCommit,
}: {
  initialMarkdown: string;
  onCommit: (nextMarkdown: string) => void;
}) {
  const commitRef = useRef(onCommit);
  const lastCommittedRef = useRef(normalizeMarkdown(initialMarkdown));

  useEffect(() => {
    commitRef.current = onCommit;
  }, [onCommit]);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Markdown,
    ],
    content: initialMarkdown,
    contentType: 'markdown',
    autofocus: 'end',
    editorProps: {
      attributes: {
        'aria-label': 'Markdown editor',
        class: 'canvas-object__wysiwyg-surface',
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
  }, [initialMarkdown]);

  useEffect(() => {
    lastCommittedRef.current = normalizeMarkdown(initialMarkdown);
  }, [initialMarkdown]);

  const syncDomIntoEditor = (container?: HTMLElement | null) => {
    if (!editor) {
      return;
    }

    const surface = container?.querySelector('.canvas-object__wysiwyg-surface');
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

  const commitIfNeeded = (container?: HTMLElement | null) => {
    syncDomIntoEditor(container);
    if (!editor) {
      return;
    }

    const nextMarkdown = normalizeMarkdown(editor.getMarkdown());
    if (nextMarkdown === lastCommittedRef.current) {
      return;
    }

    lastCommittedRef.current = nextMarkdown;
    commitRef.current(nextMarkdown);
  };

  useEffect(() => {
    return () => {
      commitIfNeeded();
    };
  }, [editor]);

  if (!editor) {
    return null;
  }

  return (
    <div
      className="canvas-object__wysiwyg"
      data-placeholder="Write text, # heading, or - list"
      onBlur={(event) => {
        const nextTarget = event.relatedTarget;
        if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
          return;
        }

        commitIfNeeded(event.currentTarget);
      }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <EditorContent editor={editor} />
    </div>
  );
}
