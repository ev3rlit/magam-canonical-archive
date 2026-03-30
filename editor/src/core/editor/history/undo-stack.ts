export interface UndoEntry<TValue> {
  label: string;
  before: TValue;
  after: TValue;
}

export class UndoStack<TValue> {
  private past: UndoEntry<TValue>[] = [];

  private future: UndoEntry<TValue>[] = [];

  push(entry: UndoEntry<TValue>) {
    this.past.push(entry);
    this.future = [];
  }

  canUndo() {
    return this.past.length > 0;
  }

  canRedo() {
    return this.future.length > 0;
  }

  clear() {
    this.past = [];
    this.future = [];
  }

  undo() {
    const entry = this.past.pop();
    if (!entry) {
      return null;
    }
    this.future.push(entry);
    return entry;
  }

  redo() {
    const entry = this.future.pop();
    if (!entry) {
      return null;
    }
    this.past.push(entry);
    return entry;
  }
}
