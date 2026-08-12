export interface Note {
  id: number;
  text: string;
  createdAt: string;
}

/**
 * Tiny in-memory note store. Intentionally not persisted — this is a demo app
 * used to exercise the development environment end to end.
 */
export class NoteStore {
  private notes: Note[] = [];
  private nextId = 1;

  list(): Note[] {
    return [...this.notes].sort((a, b) => b.id - a.id);
  }

  add(text: string): Note {
    const trimmed = text.trim();
    if (!trimmed) {
      throw new Error("Note text must not be empty");
    }
    const note: Note = {
      id: this.nextId++,
      text: trimmed,
      createdAt: new Date().toISOString(),
    };
    this.notes.push(note);
    return note;
  }

  clear(): void {
    this.notes = [];
    this.nextId = 1;
  }
}
