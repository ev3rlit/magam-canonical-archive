export function OutlinerPanel() {
  return (
    <aside
      aria-label="Outliner"
      className="editor-panel editor-panel--left"
      data-testid="outliner-panel"
    >
      <div className="editor-panel__header">
        <h2 className="editor-panel__title">Outliner</h2>
      </div>
      <div className="editor-panel__body">
        <ul className="placeholder-list">
          <li className="placeholder-card">
            <h3 className="placeholder-card__title">Workspace Root</h3>
            <p className="placeholder-card__copy">MVP starts with one workspace boundary.</p>
          </li>
          <li className="placeholder-card">
            <h3 className="placeholder-card__title">Canvas</h3>
            <p className="placeholder-card__copy">Object hierarchy and grouping will surface here.</p>
          </li>
        </ul>
      </div>
    </aside>
  );
}
