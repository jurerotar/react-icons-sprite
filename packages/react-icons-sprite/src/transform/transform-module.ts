import { parseSync } from 'oxc-parser';
import { DEFAULT_ICON_SOURCES } from '../packs/icon-resolvers';
import { applyEdits } from './edit-applier';
import { buildEdits, type EditOperation, type IconUsage } from './edit-builder';
import { fastFilter } from './fast-filter';
import { scanIconImports } from './import-scanner';
import { detectUsage } from './usage-scanner';
import { computeIconId } from '../utils/compute-icon-id';

export const ICON_SOURCE = 'react-icons-sprite';
export const ICON_COMPONENT_NAME = 'ReactIconsSpriteIcon';

type NodeRange = [number, number];

type IconSymbol = {
  pack: string;
  exportName: string;
};

const FONTAWESOME_REACT_PACK = '@fortawesome/react-fontawesome';

const isFontAwesomeIconPack = (pack: string): boolean => {
  return /^@fortawesome\/[\w-]+-svg-icons$/.test(pack);
};

type TransformResult = {
  code: string;
  map: any;
  anyReplacements: boolean;
};

const isObject = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value) && typeof value === 'object';
};

const walkAst = (
  node: unknown,
  visit: (current: Record<string, unknown>) => void,
): void => {
  if (!isObject(node)) {
    return;
  }
  visit(node);

  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      for (const child of value) {
        walkAst(child, visit);
      }
      continue;
    }
    walkAst(value, visit);
  }
};

const buildSymbolTable = (
  program: Record<string, unknown>,
  sources: readonly RegExp[],
): Map<string, IconSymbol> => {
  const table = new Map<string, IconSymbol>();
  const body = (program.body as unknown[]) ?? [];

  for (const node of body) {
    if (!isObject(node) || node.type !== 'ImportDeclaration') {
      continue;
    }
    const source = isObject(node.source) ? node.source : undefined;
    const pack = typeof source?.value === 'string' ? source.value : undefined;
    if (!pack || !sources.some((sourceMatcher) => sourceMatcher.test(pack))) {
      continue;
    }

    const specifiers = (node.specifiers as unknown[]) ?? [];
    for (const specifier of specifiers) {
      if (!isObject(specifier) || !isObject(specifier.local)) {
        continue;
      }
      const localName = specifier.local.name;
      if (typeof localName !== 'string') {
        continue;
      }

      if (specifier.type === 'ImportSpecifier') {
        const imported = isObject(specifier.imported)
          ? specifier.imported
          : undefined;
        const importedName =
          typeof imported?.name === 'string'
            ? imported.name
            : typeof imported?.value === 'string'
              ? imported.value
              : undefined;
        if (importedName) {
          table.set(localName, { pack, exportName: importedName });
        }
        continue;
      }

      if (specifier.type === 'ImportDefaultSpecifier') {
        table.set(localName, { pack, exportName: 'default' });
      }
    }
  }

  return table;
};

const detectIconUsage = (
  program: Record<string, unknown>,
  symbols: Map<string, IconSymbol>,
): IconUsage[] => {
  const usages: IconUsage[] = [];

  walkAst(program, (node) => {
    if (
      node.type !== 'JSXOpeningElement' &&
      node.type !== 'JSXClosingElement'
    ) {
      return;
    }

    const name = isObject(node.name) ? node.name : undefined;
    if (
      !name ||
      name.type !== 'JSXIdentifier' ||
      typeof name.name !== 'string'
    ) {
      return;
    }

    const symbol = symbols.get(name.name);
    if (!symbol) {
      return;
    }

    const range = name.range as NodeRange | undefined;
    if (!range || range.length !== 2) {
      return;
    }

    usages.push({
      local: name.name,
      range,
      pack: symbol.pack,
      exportName: symbol.exportName,
      kind: node.type === 'JSXOpeningElement' ? 'opening' : 'closing',
    });
  });

  return usages;
};

const detectFontAwesomeComponents = (
  program: Record<string, unknown>,
): Set<string> => {
  const componentLocals = new Set<string>();
  const body = (program.body as unknown[]) ?? [];

  for (const node of body) {
    if (!isObject(node) || node.type !== 'ImportDeclaration') {
      continue;
    }
    const source = isObject(node.source) ? node.source : undefined;
    if (source?.value !== FONTAWESOME_REACT_PACK) {
      continue;
    }

    const specifiers = (node.specifiers as unknown[]) ?? [];
    for (const specifier of specifiers) {
      if (
        !isObject(specifier) ||
        specifier.type !== 'ImportSpecifier' ||
        !isObject(specifier.local) ||
        !isObject(specifier.imported)
      ) {
        continue;
      }

      const importedName =
        typeof specifier.imported.name === 'string'
          ? specifier.imported.name
          : undefined;
      const localName =
        typeof specifier.local.name === 'string'
          ? specifier.local.name
          : undefined;

      if (importedName === 'FontAwesomeIcon' && localName) {
        componentLocals.add(localName);
      }
    }
  }

  return componentLocals;
};

type FontAwesomeIconUsage = {
  componentRange: NodeRange;
  iconAttributeRange: NodeRange;
  iconLocal: string;
  pack: string;
  exportName: string;
};

const detectFontAwesomeIconUsages = (
  program: Record<string, unknown>,
  symbols: Map<string, IconSymbol>,
  fontAwesomeComponentLocals: Set<string>,
): FontAwesomeIconUsage[] => {
  if (!fontAwesomeComponentLocals.size) {
    return [];
  }

  const usages: FontAwesomeIconUsage[] = [];

  walkAst(program, (node) => {
    if (node.type !== 'JSXOpeningElement') {
      return;
    }

    const name = isObject(node.name) ? node.name : undefined;
    if (
      !name ||
      name.type !== 'JSXIdentifier' ||
      typeof name.name !== 'string' ||
      !fontAwesomeComponentLocals.has(name.name)
    ) {
      return;
    }

    const componentRange = name.range as NodeRange | undefined;
    if (!componentRange || componentRange.length !== 2) {
      return;
    }

    const attributes = (node.attributes as unknown[]) ?? [];
    for (const attribute of attributes) {
      if (!isObject(attribute) || attribute.type !== 'JSXAttribute') {
        continue;
      }

      const attributeName = isObject(attribute.name)
        ? attribute.name
        : undefined;
      if (
        !attributeName ||
        attributeName.type !== 'JSXIdentifier' ||
        attributeName.name !== 'icon'
      ) {
        continue;
      }

      const value = isObject(attribute.value) ? attribute.value : undefined;
      if (!value || value.type !== 'JSXExpressionContainer') {
        continue;
      }

      const expression = isObject(value.expression)
        ? value.expression
        : undefined;
      if (
        !expression ||
        expression.type !== 'Identifier' ||
        typeof expression.name !== 'string'
      ) {
        continue;
      }

      const symbol = symbols.get(expression.name);
      if (!symbol || !isFontAwesomeIconPack(symbol.pack)) {
        continue;
      }

      const iconAttributeRange = attribute.range as NodeRange | undefined;
      if (!iconAttributeRange || iconAttributeRange.length !== 2) {
        continue;
      }

      usages.push({
        componentRange,
        iconAttributeRange,
        iconLocal: expression.name,
        pack: symbol.pack,
        exportName: symbol.exportName,
      });
      break;
    }
  });

  return usages;
};

const cleanupImports = (
  program: Record<string, unknown>,
  symbols: Map<string, IconSymbol>,
  usedLocals: Set<string>,
): EditOperation[] => {
  const edits: EditOperation[] = [];
  const body = (program.body as unknown[]) ?? [];

  for (const node of body) {
    if (!isObject(node) || node.type !== 'ImportDeclaration') {
      continue;
    }
    const specifiers = (node.specifiers as unknown[]) ?? [];
    const declarationRange = node.range as NodeRange | undefined;

    let hasUsedIconSpecifier = false;
    for (const specifier of specifiers) {
      if (!isObject(specifier) || !isObject(specifier.local)) {
        continue;
      }
      const localName = specifier.local.name;
      if (
        typeof localName === 'string' &&
        symbols.has(localName) &&
        usedLocals.has(localName)
      ) {
        hasUsedIconSpecifier = true;
        break;
      }
    }

    if (hasUsedIconSpecifier && declarationRange) {
      edits.push({
        type: 'remove',
        from: declarationRange[0],
        to: declarationRange[1],
      });
    }
  }

  return edits;
};

export const transformModule = (
  code: string,
  id: string,
  register: (pack: string, exportName: string) => void,
  sources: readonly RegExp[] = DEFAULT_ICON_SOURCES,
): TransformResult => {
  if (!fastFilter(code)) {
    return { code, map: null, anyReplacements: false };
  }

  const scanned = scanIconImports(code, sources);
  if (!scanned.length) {
    return { code, map: null, anyReplacements: false };
  }

  const names = scanned.flatMap((item) => item.names);
  const hasJsxComponentUsage = detectUsage(code, names);
  const hasPotentialFontAwesomeUsage =
    code.includes(FONTAWESOME_REACT_PACK) &&
    scanned.some((item) => isFontAwesomeIconPack(item.pack));

  if (!hasJsxComponentUsage && !hasPotentialFontAwesomeUsage) {
    return { code, map: null, anyReplacements: false };
  }

  const parsed = parseSync(id, code, {
    lang: 'tsx',
    sourceType: 'module',
    range: true,
  });

  const program = parsed.program as unknown as Record<string, unknown>;
  const table = buildSymbolTable(program, sources);
  if (!table.size) {
    return { code, map: null, anyReplacements: false };
  }

  const usages = detectIconUsage(program, table);
  const fontAwesomeComponentLocals = detectFontAwesomeComponents(program);
  const fontAwesomeUsages = detectFontAwesomeIconUsages(
    program,
    table,
    fontAwesomeComponentLocals,
  );

  if (!usages.length && !fontAwesomeUsages.length) {
    return { code, map: null, anyReplacements: false };
  }

  const used = new Set<string>();
  const edits = buildEdits(usages, ICON_COMPONENT_NAME, used, register);
  const registeredFontAwesomeIcons = new Set<string>();

  for (const usage of fontAwesomeUsages) {
    edits.push({
      type: 'replace',
      from: usage.componentRange[0],
      to: usage.componentRange[1],
      value: ICON_COMPONENT_NAME,
    });
    edits.push({
      type: 'insert',
      pos: usage.componentRange[1],
      value: ` iconId="${computeIconId(usage.pack, usage.exportName)}"`,
    });
    edits.push({
      type: 'remove',
      from: usage.iconAttributeRange[0],
      to: usage.iconAttributeRange[1],
    });

    used.add(usage.iconLocal);
    const key = `${usage.pack}:${usage.exportName}`;
    if (!registeredFontAwesomeIcons.has(key)) {
      registeredFontAwesomeIcons.add(key);
      register(usage.pack, usage.exportName);
    }
  }

  const cleanupEdits = cleanupImports(program, table, used);

  const magicString = applyEdits(code, [...edits, ...cleanupEdits]);

  if (!code.includes(ICON_SOURCE)) {
    magicString.prepend(
      `import { ${ICON_COMPONENT_NAME} } from "${ICON_SOURCE}";\n`,
    );
  }

  return {
    code: magicString.toString(),
    map: magicString.generateMap({ source: id, hires: true }),
    anyReplacements: true,
  };
};
