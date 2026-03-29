export interface UndoEntry<TValue> {
  label: string;
  value: TValue;
}

export class UndoStack<TValue> {
  private past: UndoEntry<TValue>[] = [];

  private future: UndoEntry<TValue>[] = [];

  push(entry: UndoEntry<TValue>) {
    this.past.push(entry);
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
