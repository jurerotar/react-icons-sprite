export type EditOperation =
  | { type: 'replace'; from: number; to: number; value: string }
  | { type: 'insert'; pos: number; value: string }
  | { type: 'remove'; from: number; to: number };

export type IconUsage = {
  local: string;
  range: [number, number];
  pack: string;
  exportName: string;
  iconId: string;
  kind: 'opening' | 'closing';
  hasIconId?: boolean;
};

export const buildEdits = (
  usages: IconUsage[],
  componentName: string,
  usedSymbols: Set<string>,
  register: (pack: string, exportName: string) => void,
): EditOperation[] => {
  const edits: EditOperation[] = [];

  for (const usage of usages) {
    if (usage.kind === 'opening') {
      if (!usage.hasIconId) {
        edits.push({
          type: 'replace',
          from: usage.range[0],
          to: usage.range[1],
          value: `${componentName} iconId="${usage.iconId}"`,
        });
      } else {
        edits.push({
          type: 'replace',
          from: usage.range[0],
          to: usage.range[1],
          value: componentName,
        });
      }
      usedSymbols.add(usage.local);
      register(usage.pack, usage.exportName);
      continue;
    }

    edits.push({
      type: 'replace',
      from: usage.range[0],
      to: usage.range[1],
      value: componentName,
    });
  }

  return edits;
};
