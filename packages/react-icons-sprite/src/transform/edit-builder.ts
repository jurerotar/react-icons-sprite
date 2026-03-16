import { computeIconId } from '../utils/compute-icon-id';

export type EditOperation =
  | { type: 'replace'; from: number; to: number; value: string }
  | { type: 'insert'; pos: number; value: string }
  | { type: 'remove'; from: number; to: number };

export type IconUsage = {
  local: string;
  range: [number, number];
  pack: string;
  exportName: string;
  kind: 'opening' | 'closing';
};

export const buildEdits = (
  usages: IconUsage[],
  componentName: string,
  usedSymbols: Set<string>,
  register: (pack: string, exportName: string) => void,
): EditOperation[] => {
  const edits: EditOperation[] = [];

  for (const usage of usages) {
    edits.push({
      type: 'replace',
      from: usage.range[0],
      to: usage.range[1],
      value: componentName,
    });

    if (usage.kind === 'opening') {
      edits.push({
        type: 'insert',
        pos: usage.range[1],
        value: ` iconId="${computeIconId(usage.pack, usage.exportName)}"`,
      });
      usedSymbols.add(usage.local);
      register(usage.pack, usage.exportName);
    }
  }

  return edits;
};
