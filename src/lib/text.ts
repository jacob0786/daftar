// Arabic vowel marks (harakat), Quranic marks and tatweel - ignored when searching
const ARABIC_MARKS = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g;
const ARABIC_CHAR = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/;
const LATIN_CHAR = /[A-Za-z]/;

// Fold text so "المُلك" matches "الملك" and "Café" matches "cafe"
export function foldForSearch(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(ARABIC_MARKS, '')
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .toLowerCase();
}

// Direction of a piece of text, decided by its first strong letter
export function isRTL(text: string | null | undefined): boolean {
  if (!text) return false;
  for (const ch of text) {
    if (ARABIC_CHAR.test(ch)) return true;
    if (LATIN_CHAR.test(ch)) return false;
  }
  return false;
}

// Does this text carry formatting marks Daftar can show (# headings, **bold**, bullets, quotes…)?
// Used when pasting, to switch a plain note to formatting so the pasted styles are kept.
export function looksFormatted(text: string): boolean {
  const lines = text.split('\n');
  const strong =
    lines.some((l) => /^#{1,3}\s+\S/.test(l) || /^>\s+\S/.test(l) || /^(---|\*\*\*)\s*$/.test(l)) ||
    /\*\*[^*\n]+\*\*|__[^_\n]+__|~~[^~\n]+~~|==[^=\n]+==|`[^`\n]+`/.test(text);
  const listLines = lines.filter((l) => /^\s*([-*•]|\d+[.)])\s+\S/.test(l)).length;
  return strong || listLines >= 2;
}

// First non-empty line, trimmed, for list previews
export function firstLine(text: string | null | undefined, skip = 0): string {
  if (!text) return '';
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  return lines[skip] ?? '';
}
