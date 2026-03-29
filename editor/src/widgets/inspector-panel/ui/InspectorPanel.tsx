export function InspectorPanel() {
  return (
    <aside
      aria-label="Inspector"
      className="editor-panel editor-panel--right"
      data-testid="inspector-panel"
    >
      <div className="editor-panel__header">
        <h2 className="editor-panel__title">Inspector</h2>
      </div>
      <div className="editor-panel__body">
        <ul className="placeholder-list">
          <li className="placeholder-card">
            <h3 className="placeholder-card__title">Selection</h3>
            <p className="placeholder-card__copy">Selected object metadata will live here.</p>
          </li>
          <li className="placeholder-card">
            <h3 className="placeholder-card__title">Properties</h3>
            <p className="placeholder-card__copy">Style and layout controls are future feature slices.</p>
          </li>
        </ul>
      </div>
    </aside>
  );
}
