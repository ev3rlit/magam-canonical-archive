export function TopToolbar() {
  return (
    <header className="top-toolbar" data-testid="top-toolbar">
      <div className="top-toolbar__group">
        <button className="top-toolbar__button" type="button">Select</button>
        <button className="top-toolbar__button" type="button">Pan</button>
        <button className="top-toolbar__button" type="button">Frame</button>
      </div>
      <div className="top-toolbar__group">
        <button className="top-toolbar__button" type="button">Undo</button>
        <button className="top-toolbar__button" type="button">Redo</button>
        <button className="top-toolbar__button" type="button">Layout</button>
      </div>
    </header>
  );
}
