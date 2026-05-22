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
  hasIconId?: boolean;
};

export const buildEdits = (
  usages: IconUsage[],
  componentName: string,
  usedSymbols: Set<string>,
  register: (pack: string, exportName: string) => void,
): EditOperation[] => {
  const edits: EditOperation[] = [];
  const iconIdCache = new Map<string, string>();

  for (const usage of usages) {
    edits.push({
      type: 'replace',
      from: usage.range[0],
      to: usage.range[1],
      value: componentName,
    });

    if (usage.kind === 'opening') {
      if (!usage.hasIconId) {
        const key = `${usage.pack}:${usage.exportName}`;
        let iconId = iconIdCache.get(key);
        if (!iconId) {
          iconId = computeIconId(usage.pack, usage.exportName);
          iconIdCache.set(key, iconId);
        }

        edits.push({
          type: 'insert',
          pos: usage.range[1],
          value: ` iconId="${iconId}"`,
        });
      }
      usedSymbols.add(usage.local);
      register(usage.pack, usage.exportName);
    }
  }

  return edits;
};
