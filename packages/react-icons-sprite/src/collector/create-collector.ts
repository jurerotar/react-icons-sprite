export type CollectedIcon = {
  pack: string;
  exportName: string;
};

export type IconCollector = {
  add: (pack: string, exportName: string) => void;
  toList: () => CollectedIcon[];
  clear: () => void;
};

export const createCollector = (): IconCollector => {
  const collected = new Set<string>();

  return {
    add(pack: string, exportName: string) {
      collected.add(`${pack}:${exportName}`);
    },

    toList() {
      return [...collected].map((key) => {
        const [pack, exportName] = key.split(':');
        return { pack, exportName };
      });
    },

    clear() {
      collected.clear();
    },
  };
};
