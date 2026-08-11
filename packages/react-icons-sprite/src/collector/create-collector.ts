export type CollectedIcon = {
  pack: string;
  exportName: string;
  importer?: string;
  importPath?: string;
};

export type IconCollector = {
  add: (
    pack: string,
    exportName: string,
    options?: Pick<CollectedIcon, 'importer' | 'importPath'>,
  ) => void;
  toList: () => CollectedIcon[];
  clear: () => void;
};

const createCollectedIconKey = (icon: CollectedIcon): string => {
  const resolutionKey =
    icon.importPath ?? (icon.pack.startsWith('.') ? icon.importer : undefined);

  return JSON.stringify([icon.pack, icon.exportName, resolutionKey]);
};

export const createCollector = (): IconCollector => {
  const collected = new Map<string, CollectedIcon>();

  return {
    add(pack: string, exportName: string, options = {}) {
      const item: CollectedIcon = {
        pack,
        exportName,
        ...options,
      };
      collected.set(createCollectedIconKey(item), item);
    },

    toList() {
      return [...collected.values()];
    },

    clear() {
      collected.clear();
    },
  };
};
