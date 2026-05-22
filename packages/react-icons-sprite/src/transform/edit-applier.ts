import MagicString from 'magic-string';
import type { EditOperation } from './edit-builder';

export const applyEdits = (
  code: string,
  edits: EditOperation[],
): MagicString => {
  const magicString = new MagicString(code);

  for (const edit of edits) {
    if (edit.type === 'replace') {
      magicString.overwrite(edit.from, edit.to, edit.value);
    }
    if (edit.type === 'insert') {
      magicString.appendLeft(edit.pos, edit.value);
    }
    if (edit.type === 'remove') {
      magicString.remove(edit.from, edit.to);
    }
  }

  return magicString;
};

const editStart = (edit: EditOperation): number => {
  return edit.type === 'insert' ? edit.pos : edit.from;
};

export const applyEditsToString = (
  code: string,
  edits: EditOperation[],
): string => {
  if (!edits.length) {
    return code;
  }

  const orderedEdits = [...edits].sort((left, right) => {
    const startDelta = editStart(left) - editStart(right);
    if (startDelta !== 0) {
      return startDelta;
    }
    if (left.type === 'insert' && right.type !== 'insert') {
      return 1;
    }
    if (left.type !== 'insert' && right.type === 'insert') {
      return -1;
    }
    return 0;
  });

  let result = '';
  let cursor = 0;

  for (const edit of orderedEdits) {
    if (edit.type === 'insert') {
      if (edit.pos <= cursor) {
        result += edit.value;
        continue;
      }
      result += code.slice(cursor, edit.pos) + edit.value;
      cursor = edit.pos;
      continue;
    }

    result += code.slice(cursor, edit.from);
    if (edit.type === 'replace') {
      result += edit.value;
    }
    cursor = edit.to;
  }

  return result + code.slice(cursor);
};
