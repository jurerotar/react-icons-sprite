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
