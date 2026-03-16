const IMPORT_RE = /import\s+([^;]+?)\s+from\s+['"]([^'"]+)['"]/g;

export type ImportScan = {
  pack: string;
  names: string[];
};

export const scanIconImports = (
  code: string,
  sources: readonly RegExp[],
): ImportScan[] => {
  const imports: ImportScan[] = [];

  for (const match of code.matchAll(IMPORT_RE)) {
    const [, specifier, pack] = match;

    if (!sources.some((source) => source.test(pack))) {
      continue;
    }

    const names = specifier
      .replace(/[{}]/g, '')
      .split(',')
      .map((segment) => segment.trim())
      .filter(Boolean)
      .map((segment) => segment.split(' as ')[1] ?? segment);

    imports.push({ pack, names });
  }

  return imports;
};
