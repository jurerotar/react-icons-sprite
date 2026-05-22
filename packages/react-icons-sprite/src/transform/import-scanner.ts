const IMPORT_RE = /import\s+([^;]+?)\s+from\s+['"]([^'"]+)['"]/g;

export type ImportScan = {
  pack: string;
  names: string[];
};

const sourceMatches = (source: RegExp, pack: string): boolean => {
  source.lastIndex = 0;
  return source.test(pack);
};

export const scanIconImports = (
  code: string,
  sources: readonly RegExp[],
): ImportScan[] => {
  const imports: ImportScan[] = [];

  for (const match of code.matchAll(IMPORT_RE)) {
    const [, specifier, pack] = match;

    if (!sources.some((source) => sourceMatches(source, pack))) {
      continue;
    }

    const normalizedSpecifier = specifier.trim();
    if (normalizedSpecifier.startsWith('type ')) {
      continue;
    }

    const names = specifier
      .replace(/[{}]/g, '')
      .split(',')
      .map((segment) => segment.trim())
      .filter((segment) => !segment.startsWith('type '))
      .filter(Boolean)
      .map((segment) => segment.split(' as ')[1] ?? segment);

    if (names.length) {
      imports.push({ pack, names });
    }
  }

  return imports;
};
