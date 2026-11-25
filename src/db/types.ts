export type NoteKind = 'text' | 'checklist';
export type NoteStatus = 'active' | 'archived' | 'trash';
export type NoteFormat = 'plain' | 'rich'; // rich = formatting toolbar + formatted reading view

export type ChecklistItem = { id: string; text: string; done: boolean };

// The 9 ColorNote colour slots, in ColorNote's order. null = no colour.
export type ColorIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export type Note = {
  id: string;
  title: string;
  body: string; // empty for checklists and locked notes
  kind: NoteKind;
  items: ChecklistItem[]; // empty for text notes and locked notes
  color: ColorIndex | null;
  labels: string[]; // label ids
  status: NoteStatus;
  pinned: boolean;
  locked: boolean;
  cipher: string | null; // encrypted { body, items } when locked
  format: NoteFormat;
  dateAt: number | null; // a date the note is about (shown in the calendar), ms at local midnight
  createdAt: number; // ms
  editedAt: number; // ms, last time the words changed (shown in the list)
  updatedAt: number; // ms, last change of any kind (used by sync)
  seen: boolean; // false when another device changed it and it hasn't been opened
};

export type Label = { id: string; name: string; updatedAt: number };

// Content that gets encrypted inside a locked note
export type LockedContent = { body: string; items: ChecklistItem[] };
