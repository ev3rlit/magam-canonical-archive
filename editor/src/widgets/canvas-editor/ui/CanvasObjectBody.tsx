'use client';

import clsx from 'clsx';
import { useEffect, useState, type FocusEvent, type KeyboardEvent, type MouseEvent, type PointerEvent, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useEditorStore } from '@/core/editor/model/editor-store';
import type { EditorCanvasObject, EditorContentBlock } from '@/core/editor/model/editor-types';

interface BlockDraftState {
  blockId: string;
  blockType: EditorContentBlock['blockType'];
  text: string;
  src: string;
  alt: string;
}

function toDraft(block: EditorContentBlock): BlockDraftState {
  if (block.blockType === 'text') {
    return {
      blockId: block.id,
      blockType: block.blockType,
      text: block.text,
      src: '',
      alt: '',
    };
  }

  if (block.blockType === 'markdown') {
    return {
      blockId: block.id,
      blockType: block.blockType,
      text: block.source,
      src: '',
      alt: '',
    };
  }

  return {
    blockId: block.id,
    blockType: block.blockType,
    text: '',
    src: block.src,
    alt: block.alt,
  };
}

function stopCanvasPointer(event: PointerEvent | MouseEvent) {
  event.stopPropagation();
}

function handleEditorKeyDown(input: {
  event: KeyboardEvent<HTMLElement>;
  commit: () => void;
  cancel: () => void;
}) {
  if (input.event.key === 'Escape') {
    input.event.stopPropagation();
    input.event.preventDefault();
    input.cancel();
    return;
  }

  if ((input.event.metaKey || input.event.ctrlKey) && input.event.key === 'Enter') {
    input.event.preventDefault();
    input.commit();
  }
}

function BlockEditor({
  block,
  draft,
  setDraft,
  commit,
  cancel,
}: {
  block: EditorContentBlock;
  draft: BlockDraftState | null;
  setDraft: (draft: BlockDraftState | null) => void;
  commit: () => void;
  cancel: () => void;
}) {
  if (!draft) {
    return null;
  }

  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
      return;
    }
    commit();
  };

  if (block.blockType === 'canvas.image') {
    return (
      <div
        className="canvas-object__block-editor canvas-object__block-editor--image"
        onBlur={handleBlur}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => handleEditorKeyDown({ event, commit, cancel })}
        onPointerDown={stopCanvasPointer}
      >
        <label className="canvas-object__block-field">
          <span>Image URL</span>
          <input
            autoFocus
            className="canvas-object__block-input"
            onChange={(event) => setDraft({
              ...draft,
              src: event.target.value,
            })}
            value={draft.src}
          />
        </label>
        <label className="canvas-object__block-field">
          <span>Alt text</span>
          <input
            className="canvas-object__block-input"
            onChange={(event) => setDraft({
              ...draft,
              alt: event.target.value,
            })}
            value={draft.alt}
          />
        </label>
        <div className="canvas-object__block-actions">
          <button className="canvas-object__block-action" onClick={commit} type="button">
            Apply
          </button>
          <button className="canvas-object__block-action canvas-object__block-action--secondary" onClick={cancel} type="button">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="canvas-object__block-editor"
      onBlur={handleBlur}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => handleEditorKeyDown({ event, commit, cancel })}
      onPointerDown={stopCanvasPointer}
    >
      <textarea
        autoFocus
        className="canvas-object__block-textarea"
        onChange={(event) => setDraft({
          ...draft,
          text: event.target.value,
        })}
        value={draft.text}
      />
      <div className="canvas-object__block-actions">
        <button className="canvas-object__block-action" onClick={commit} type="button">
          Apply
        </button>
        <button className="canvas-object__block-action canvas-object__block-action--secondary" onClick={cancel} type="button">
          Cancel
        </button>
      </div>
    </div>
  );
}

function BlockPreview({ block }: { block: EditorContentBlock }) {
  if (block.blockType === 'text') {
    return (
      <p className="canvas-object__block-paragraph">
        {block.text || 'Empty text block'}
      </p>
    );
  }

  if (block.blockType === 'markdown') {
    return (
      <div className="canvas-object__block-markdown">
        {block.source.trim().length > 0 ? (
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {block.source}
          </ReactMarkdown>
        ) : (
          <p>Empty markdown block</p>
        )}
      </div>
    );
  }

  return (
    <figure className="canvas-object__image-block">
      <img alt={block.alt || 'Canvas image block'} className="canvas-object__image" src={block.src} />
      {block.alt ? <figcaption>{block.alt}</figcaption> : null}
    </figure>
  );
}

function AddBlockPalette({
  visible,
  onInsert,
}: {
  visible: boolean;
  onInsert: (type: 'markdown' | 'text' | 'image') => void;
}) {
  if (!visible) {
    return null;
  }

  return (
    <div className="canvas-object__block-palette" onClick={(event) => event.stopPropagation()} onPointerDown={stopCanvasPointer}>
      <button className="canvas-object__block-chip" onClick={() => onInsert('markdown')} type="button">
        Markdown
      </button>
      <button className="canvas-object__block-chip" onClick={() => onInsert('text')} type="button">
        Text
      </button>
      <button className="canvas-object__block-chip" onClick={() => onInsert('image')} type="button">
        Image
      </button>
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
  const blockSelection = useEditorStore((state) => state.overlays.blockSelection);
  const blockEditor = useEditorStore((state) => state.overlays.blockEditor);
  const selectBlock = useEditorStore((state) => state.selectBlock);
  const insertBlock = useEditorStore((state) => state.insertBlock);
  const startBlockEdit = useEditorStore((state) => state.startBlockEdit);
  const commitBlockEdit = useEditorStore((state) => state.commitBlockEdit);
  const cancelBlockEdit = useEditorStore((state) => state.cancelBlockEdit);
  const removeBlock = useEditorStore((state) => state.removeBlock);
  const [draft, setDraft] = useState<BlockDraftState | null>(null);

  const selectedBlockId = blockSelection?.objectId === object.id ? blockSelection.blockId : null;
  const editingBlockId = blockEditor?.objectId === object.id ? blockEditor.blockId : null;
  const editingBlock = editingBlockId
    ? object.contentBlocks.find((block) => block.id === editingBlockId) ?? null
    : null;

  useEffect(() => {
    if (!editingBlock) {
      setDraft(null);
      return;
    }

    setDraft(toDraft(editingBlock));
  }, [editingBlock]);

  const handleInsert = (type: 'markdown' | 'text' | 'image') => {
    insertBlock(object.id, type, selectedBlockId);
  };

  const handleCommit = () => {
    if (!draft || !editingBlock) {
      return;
    }

    if (draft.blockType === 'canvas.image') {
      commitBlockEdit(object.id, editingBlock.id, {
        src: draft.src,
        alt: draft.alt,
      });
      return;
    }

    commitBlockEdit(object.id, editingBlock.id, draft.blockType === 'markdown'
      ? { source: draft.text }
      : { text: draft.text });
  };

  const handleCancel = () => {
    cancelBlockEdit();
    setDraft(editingBlock ? toDraft(editingBlock) : null);
  };

  const emptyState: ReactNode = object.contentBlocks.length === 0 ? (
    <div className={clsx('canvas-object__empty-state', {
      'canvas-object__empty-state--active': isSelected,
    })}>
      <p>Add blocks like notes, markdown, or images.</p>
      <AddBlockPalette visible={isSelected} onInsert={handleInsert} />
    </div>
  ) : null;

  return (
    <div className="canvas-object__content-stack">
      {object.contentBlocks.map((block) => {
        const isBlockSelected = selectedBlockId === block.id;
        const isEditing = editingBlockId === block.id;

        return (
          <div
            className={clsx('canvas-object__block', {
              'canvas-object__block--active': isBlockSelected,
              'canvas-object__block--editing': isEditing,
            })}
            key={block.id}
            onClick={(event) => {
              event.stopPropagation();
              if (!isSelected) {
                return;
              }

              if (!isEditing) {
                selectBlock(object.id, block.id);
                startBlockEdit(object.id, block.id);
              }
            }}
            onPointerDown={(event) => {
              if (!isSelected) {
                return;
              }

              event.stopPropagation();
              selectBlock(object.id, block.id);
            }}
          >
            <div className="canvas-object__block-meta">
              <span className="canvas-object__block-kind">{block.blockType === 'canvas.image' ? 'Image' : block.blockType}</span>
              {isSelected ? (
                <button
                  className="canvas-object__block-remove"
                  onClick={(event) => {
                    event.stopPropagation();
                    removeBlock(object.id, block.id);
                  }}
                  onPointerDown={stopCanvasPointer}
                  type="button"
                >
                  Remove
                </button>
              ) : null}
            </div>
            {isEditing ? (
              <BlockEditor
                block={block}
                cancel={handleCancel}
                commit={handleCommit}
                draft={draft}
                setDraft={setDraft}
              />
            ) : (
              <BlockPreview block={block} />
            )}
            <AddBlockPalette visible={isSelected && selectedBlockId === block.id && !isEditing} onInsert={handleInsert} />
          </div>
        );
      })}
      {emptyState}
      {object.contentBlocks.length > 0 ? (
        <AddBlockPalette visible={isSelected && selectedBlockId === null && !editingBlockId} onInsert={handleInsert} />
      ) : null}
      {isSelected && object.contentBlocks.length > 0 && selectedBlockId === null ? (
        <button
          className="canvas-object__select-hint"
          onClick={(event) => {
            event.stopPropagation();
            const firstBlock = object.contentBlocks[0];
            if (!firstBlock) {
              return;
            }
            selectBlock(object.id, firstBlock.id);
          }}
          onPointerDown={stopCanvasPointer}
          type="button"
        >
          Select a block to insert after it
        </button>
      ) : null}
    </div>
  );
}
