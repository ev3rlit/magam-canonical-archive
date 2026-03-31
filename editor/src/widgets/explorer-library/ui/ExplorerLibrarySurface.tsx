'use client';

import { useEffect, useState } from 'react';
import type { LibraryCollection, LibraryItemRecord } from '@magam/explorer-library';
import { useExplorerLibraryStore, type ExplorerLibraryView } from '@/core/editor/explorer-library/library-store';
import { WidgetBase } from '@/shared/ui/WidgetBase';

function formatTags(value: string[]) {
  return value.join(', ');
}

function parseTags(value: string) {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function ItemCard({
  item,
  selected,
  onSelect,
  onApply,
  onOpen,
}: {
  item: LibraryItemRecord;
  selected: boolean;
  onSelect: () => void;
  onApply: () => void;
  onOpen: () => void;
}) {
  return (
    <article
      className={`explorer-library-card${selected ? ' explorer-library-card--selected' : ''}`}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect();
        }
      }}
    >
      <div className="explorer-library-card__meta">
        <span className="explorer-library-card__type">{item.type}</span>
        <span className="explorer-library-card__visibility">{item.visibility}</span>
      </div>
      <h3 className="explorer-library-card__title">{item.title}</h3>
      {item.summary ? <p className="explorer-library-card__summary">{item.summary}</p> : null}
      {item.tags.length > 0 ? (
        <p className="explorer-library-card__tags">{item.tags.join(' · ')}</p>
      ) : null}
      <div className="explorer-library-card__actions">
        <button onClick={(event) => { event.stopPropagation(); onApply(); }} type="button">
          {item.type === 'template' ? 'Apply' : item.type === 'asset' ? 'Insert' : 'Attach'}
        </button>
        {item.type === 'reference' ? (
          <button onClick={(event) => { event.stopPropagation(); onOpen(); }} type="button">
            Open
          </button>
        ) : null}
      </div>
    </article>
  );
}

function ViewTabs({
  value,
  onChange,
  includeAll,
}: {
  value: ExplorerLibraryView;
  onChange: (view: ExplorerLibraryView) => void;
  includeAll?: boolean;
}) {
  const views: ExplorerLibraryView[] = includeAll
    ? ['recent', 'imported', 'favorites', 'curated', 'all']
    : ['recent', 'imported', 'favorites'];

  return (
    <div className="explorer-library-tabs">
      {views.map((view) => (
        <button
          aria-pressed={value === view}
          className={`explorer-library-tabs__button${value === view ? ' explorer-library-tabs__button--active' : ''}`}
          key={view}
          onClick={() => onChange(view)}
          type="button"
        >
          {view}
        </button>
      ))}
    </div>
  );
}

function CollectionRail({
  collections,
  activeCollectionId,
  onSelect,
  onCreate,
}: {
  collections: LibraryCollection[];
  activeCollectionId: string | null;
  onSelect: (collectionId: string | null) => void;
  onCreate: (name: string) => void;
}) {
  const [draft, setDraft] = useState('');

  return (
    <aside className="explorer-library-rail">
      <button
        aria-pressed={activeCollectionId === null}
        className={`explorer-library-rail__item${activeCollectionId === null ? ' explorer-library-rail__item--active' : ''}`}
        onClick={() => onSelect(null)}
        type="button"
      >
        All collections
      </button>
      {collections.map((collection) => (
        <button
          aria-pressed={activeCollectionId === collection.id}
          className={`explorer-library-rail__item${activeCollectionId === collection.id ? ' explorer-library-rail__item--active' : ''}`}
          key={collection.id}
          onClick={() => onSelect(collection.id)}
          type="button"
        >
          {collection.name}
        </button>
      ))}
      <form
        className="explorer-library-rail__form"
        onSubmit={(event) => {
          event.preventDefault();
          if (draft.trim().length === 0) {
            return;
          }
          onCreate(draft.trim());
          setDraft('');
        }}
      >
        <input
          onChange={(event) => setDraft(event.target.value)}
          placeholder="New collection"
          value={draft}
        />
        <button type="submit">Add</button>
      </form>
    </aside>
  );
}

function DetailInspector({
  item,
  collections,
  onSave,
  onApply,
  onOpen,
}: {
  item: LibraryItemRecord | null;
  collections: LibraryCollection[];
  onSave: (input: {
    itemId: string;
    title?: string;
    summary?: string | null;
    tags?: string[];
    collectionIds?: string[];
    isFavorite?: boolean;
  }) => void;
  onApply: (itemId: string) => void;
  onOpen: (itemId: string) => void;
}) {
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [tags, setTags] = useState('');
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<string[]>([]);

  useEffect(() => {
    setTitle(item?.title ?? '');
    setSummary(item?.summary ?? '');
    setTags(item ? formatTags(item.tags) : '');
    setSelectedCollectionIds(item?.collectionIds ?? []);
  }, [item]);

  if (!item) {
    return (
      <section className="explorer-library-detail explorer-library-detail--empty">
        <p>Select an item to inspect and curate it.</p>
      </section>
    );
  }

  return (
    <section className="explorer-library-detail">
      <div className="explorer-library-detail__header">
        <div>
          <h2>{item.title}</h2>
          <p>{item.type} · {item.visibility}</p>
        </div>
        <button
          aria-pressed={item.isFavorite}
          onClick={() => onSave({
            itemId: item.id,
            isFavorite: !item.isFavorite,
          })}
          type="button"
        >
          {item.isFavorite ? 'Favorite' : 'Add Favorite'}
        </button>
      </div>
      <label className="explorer-library-detail__field">
        <span>Title</span>
        <input onChange={(event) => setTitle(event.target.value)} value={title} />
      </label>
      <label className="explorer-library-detail__field">
        <span>Summary</span>
        <textarea onChange={(event) => setSummary(event.target.value)} value={summary} />
      </label>
      <label className="explorer-library-detail__field">
        <span>Tags</span>
        <input onChange={(event) => setTags(event.target.value)} value={tags} />
      </label>
      <div className="explorer-library-detail__collections">
        <span>Collections</span>
        {collections.map((collection) => (
          <label className="explorer-library-detail__checkbox" key={collection.id}>
            <input
              checked={selectedCollectionIds.includes(collection.id)}
              onChange={(event) => {
                setSelectedCollectionIds(event.target.checked
                  ? [...selectedCollectionIds, collection.id]
                  : selectedCollectionIds.filter((collectionId) => collectionId !== collection.id));
              }}
              type="checkbox"
            />
            {collection.name}
          </label>
        ))}
      </div>
      <div className="explorer-library-detail__actions">
        <button
          onClick={() => onSave({
            itemId: item.id,
            title,
            summary: summary.length > 0 ? summary : null,
            tags: parseTags(tags),
            collectionIds: selectedCollectionIds,
          })}
          type="button"
        >
          Save Metadata
        </button>
        <button onClick={() => onApply(item.id)} type="button">
          {item.type === 'template' ? 'Apply' : item.type === 'asset' ? 'Insert' : 'Attach'}
        </button>
        {item.type === 'reference' ? (
          <button onClick={() => onOpen(item.id)} type="button">
            Open
          </button>
        ) : null}
      </div>
    </section>
  );
}

function CreatorTools() {
  const importAssetFile = useExplorerLibraryStore((state) => state.importAssetFile);
  const createReference = useExplorerLibraryStore((state) => state.createReference);
  const [referenceTitle, setReferenceTitle] = useState('');
  const [referenceTarget, setReferenceTarget] = useState('');

  return (
    <section className="explorer-library-creator">
      <div className="explorer-library-creator__actions">
        <label className="explorer-library-creator__file">
          <span>Import Asset</span>
          <input
            accept="image/*,.pdf,text/*"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) {
                return;
              }
              void importAssetFile(file);
              event.target.value = '';
            }}
            type="file"
          />
        </label>
      </div>
      <form
        className="explorer-library-creator__reference"
        onSubmit={(event) => {
          event.preventDefault();
          if (referenceTitle.trim().length === 0 || referenceTarget.trim().length === 0) {
            return;
          }
          void createReference({
            title: referenceTitle.trim(),
            targetKind: 'url',
            target: referenceTarget.trim(),
            displayHint: referenceTarget.trim(),
          });
          setReferenceTitle('');
          setReferenceTarget('');
        }}
      >
        <input
          onChange={(event) => setReferenceTitle(event.target.value)}
          placeholder="Reference title"
          value={referenceTitle}
        />
        <input
          onChange={(event) => setReferenceTarget(event.target.value)}
          placeholder="https://example.com"
          value={referenceTarget}
        />
        <button type="submit">Save Reference</button>
      </form>
    </section>
  );
}

function ExplorerLibraryContent({ variant }: { variant: 'quick' | 'page' }) {
  const status = useExplorerLibraryStore((state) => state.status);
  const items = useExplorerLibraryStore((state) => state.items);
  const collections = useExplorerLibraryStore((state) => state.collections);
  const selectedItemId = useExplorerLibraryStore((state) => state.selectedItemId);
  const searchQuery = useExplorerLibraryStore((state) => state.searchQuery);
  const view = useExplorerLibraryStore((state) => state.view);
  const activeCollectionId = useExplorerLibraryStore((state) => state.activeCollectionId);
  const errorMessage = useExplorerLibraryStore((state) => state.errorMessage);
  const setSearchQuery = useExplorerLibraryStore((state) => state.setSearchQuery);
  const setView = useExplorerLibraryStore((state) => state.setView);
  const setActiveCollectionId = useExplorerLibraryStore((state) => state.setActiveCollectionId);
  const selectItem = useExplorerLibraryStore((state) => state.selectItem);
  const applyItem = useExplorerLibraryStore((state) => state.applyItem);
  const openReference = useExplorerLibraryStore((state) => state.openReference);
  const updateMetadata = useExplorerLibraryStore((state) => state.updateMetadata);
  const createCollection = useExplorerLibraryStore((state) => state.createCollection);
  const selectedItem = items.find((item) => item.id === selectedItemId) ?? null;

  if (variant === 'quick') {
    return (
      <div className="explorer-library explorer-library--quick" data-testid="quick-explorer">
        <div className="explorer-library__toolbar">
          <ViewTabs onChange={(nextView) => void setView(nextView)} value={view} />
          <input
            className="explorer-library__search"
            onChange={(event) => void setSearchQuery(event.target.value)}
            placeholder="Search library"
            value={searchQuery}
          />
        </div>
        {errorMessage ? <p className="explorer-library__error">{errorMessage}</p> : null}
        {status === 'loading' ? <p className="explorer-library__status">Loading library…</p> : null}
        {items.length > 0 ? (
          <div className="explorer-library-quick-layout">
            <div className="explorer-library__grid">
              {items.map((item) => (
                <ItemCard
                  item={item}
                  key={item.id}
                  onApply={() => void applyItem(item.id)}
                  onOpen={() => void openReference(item.id)}
                  onSelect={() => selectItem(item.id)}
                  selected={selectedItemId === item.id}
                />
              ))}
            </div>
            <DetailInspector
              collections={collections}
              item={selectedItem}
              onApply={(itemId) => void applyItem(itemId)}
              onOpen={(itemId) => void openReference(itemId)}
                onSave={(input) => void updateMetadata(input)}
              />
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="explorer-library explorer-library--page" data-testid="library-page">
      <div className="explorer-library__toolbar explorer-library__toolbar--page">
        <ViewTabs includeAll onChange={(nextView) => void setView(nextView)} value={view} />
        <input
          className="explorer-library__search"
          onChange={(event) => void setSearchQuery(event.target.value)}
          placeholder="Search templates, assets, and references"
          value={searchQuery}
        />
      </div>
      {errorMessage ? <p className="explorer-library__error">{errorMessage}</p> : null}
      <CreatorTools />
      <div className="explorer-library-layout">
        <CollectionRail
          activeCollectionId={activeCollectionId}
          collections={collections}
          onCreate={(name) => void createCollection(name)}
          onSelect={(collectionId) => void setActiveCollectionId(collectionId)}
        />
        <div className="explorer-library-layout__main">
          <div className="explorer-library__grid explorer-library__grid--page">
            {items.map((item) => (
              <ItemCard
                item={item}
                key={item.id}
                onApply={() => void applyItem(item.id)}
                onOpen={() => void openReference(item.id)}
                onSelect={() => selectItem(item.id)}
                selected={selectedItemId === item.id}
              />
            ))}
          </div>
        </div>
        <DetailInspector
          collections={collections}
          item={selectedItem}
          onApply={(itemId) => void applyItem(itemId)}
          onOpen={(itemId) => void openReference(itemId)}
          onSave={(input) => void updateMetadata(input)}
        />
      </div>
    </div>
  );
}

export function QuickExplorerPanel() {
  const itemCount = useExplorerLibraryStore((state) => state.items.length);

  return (
    <WidgetBase
      bodyClassName="explorer-library-panel__body"
      collapsible
      entryDelayMs={260}
      panelId="quickExplorer"
      side="bottom"
      subtitle={itemCount > 0 ? `${itemCount} items` : undefined}
      title="Library"
    >
      <ExplorerLibraryContent variant="quick" />
    </WidgetBase>
  );
}

export function ExplorerLibraryPage() {
  return <ExplorerLibraryContent variant="page" />;
}
