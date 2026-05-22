import { parseSync, Visitor } from 'oxc-parser';
import type { SourceMap } from 'magic-string';
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
  map: SourceMap | null;
  anyReplacements: boolean;
};

type TransformModuleOptions = {
  sourceMap?: boolean;
};

type ImportSpecifierMeta = {
  local: string;
  specifier: Record<string, unknown>;
};

type SpriteIconImport = {
  hasImport: boolean;
  localName: string;
};

const sourceMatches = (source: RegExp, pack: string): boolean => {
  source.lastIndex = 0;
  return source.test(pack);
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
    if (
      !pack ||
      node.importKind === 'type' ||
      !sources.some((sourceMatcher) => sourceMatches(sourceMatcher, pack))
    ) {
      continue;
    }

    const specifiers = (node.specifiers as unknown[]) ?? [];
    for (const specifier of specifiers) {
      if (!isObject(specifier) || !isObject(specifier.local)) {
        continue;
      }
      if (specifier.importKind === 'type') {
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

const findSpriteIconImport = (
  program: Record<string, unknown>,
): SpriteIconImport => {
  const body = (program.body as unknown[]) ?? [];

  for (const node of body) {
    if (!isObject(node) || node.type !== 'ImportDeclaration') {
      continue;
    }
    const source = isObject(node.source) ? node.source : undefined;
    if (source?.value !== ICON_SOURCE) {
      continue;
    }

    const specifiers = (node.specifiers as unknown[]) ?? [];
    for (const specifier of specifiers) {
      if (
        !isObject(specifier) ||
        specifier.type !== 'ImportSpecifier' ||
        !isObject(specifier.imported) ||
        !isObject(specifier.local)
      ) {
        continue;
      }

      const importedName =
        typeof specifier.imported.name === 'string'
          ? specifier.imported.name
          : typeof specifier.imported.value === 'string'
            ? specifier.imported.value
            : undefined;
      const localName =
        typeof specifier.local.name === 'string'
          ? specifier.local.name
          : undefined;

      if (importedName === ICON_COMPONENT_NAME && localName) {
        return { hasImport: true, localName };
      }
    }
  }

  return { hasImport: false, localName: ICON_COMPONENT_NAME };
};

const detectIconUsage = (
  program: Record<string, unknown>,
  symbols: Map<string, IconSymbol>,
): IconUsage[] => {
  const usages: IconUsage[] = [];

  const visitElement = (
    node: Record<string, unknown>,
    kind: 'opening' | 'closing',
  ): void => {
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

    let hasIconId = false;
    if (kind === 'opening') {
      const attributes = (node.attributes as unknown[]) ?? [];
      hasIconId = attributes.some((attribute) => {
        if (!isObject(attribute) || attribute.type !== 'JSXAttribute') {
          return false;
        }
        const attributeName = isObject(attribute.name)
          ? attribute.name
          : undefined;
        return (
          attributeName?.type === 'JSXIdentifier' &&
          attributeName.name === 'iconId'
        );
      });
    }

    usages.push({
      local: name.name,
      range,
      pack: symbol.pack,
      exportName: symbol.exportName,
      kind,
      hasIconId,
    });
  };

  const visitor = new Visitor({
    JSXOpeningElement(node: unknown) {
      if (isObject(node)) {
        visitElement(node, 'opening');
      }
    },
    JSXClosingElement(node: unknown) {
      if (isObject(node)) {
        visitElement(node, 'closing');
      }
    },
  });
  visitor.visit(program as unknown as Parameters<Visitor['visit']>[0]);

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
  componentLocal: string;
  componentRange: NodeRange;
  iconAttributeRange: NodeRange;
  hasIconId: boolean;
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
    let hasIconId = false;
    for (const attribute of attributes) {
      if (!isObject(attribute) || attribute.type !== 'JSXAttribute') {
        continue;
      }

      const attributeName = isObject(attribute.name)
        ? attribute.name
        : undefined;
      if (!attributeName || attributeName.type !== 'JSXIdentifier') {
        continue;
      }
      if (attributeName.name === 'iconId') {
        hasIconId = true;
        continue;
      }
      if (attributeName.name !== 'icon') {
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
        componentLocal: name.name,
        componentRange,
        iconAttributeRange,
        hasIconId,
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
  code: string,
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

    const iconSpecifiers: ImportSpecifierMeta[] = [];
    for (const specifier of specifiers) {
      if (!isObject(specifier) || !isObject(specifier.local)) {
        continue;
      }
      const localName = specifier.local.name;
      if (typeof localName !== 'string' || !symbols.has(localName)) {
        continue;
      }
      iconSpecifiers.push({ local: localName, specifier });
    }

    const usedSpecifiers = iconSpecifiers.filter(({ local }) =>
      usedLocals.has(local),
    );
    if (!usedSpecifiers.length) {
      continue;
    }

    if (
      usedSpecifiers.length === iconSpecifiers.length &&
      specifiers.length === iconSpecifiers.length &&
      declarationRange
    ) {
      edits.push({
        type: 'remove',
        from: declarationRange[0],
        to: extendToLineEnd(code, declarationRange[1]),
      });
      continue;
    }

    for (const { specifier } of usedSpecifiers) {
      const range = specifier.range as NodeRange | undefined;
      if (!range || range.length !== 2) {
        continue;
      }
      const [from, to] = specifierRemovalRange(code, range);
      edits.push({ type: 'remove', from, to });
    }
  }

  return edits;
};

const cleanupFontAwesomeComponentImports = (
  code: string,
  program: Record<string, unknown>,
  usedLocals: Set<string>,
): EditOperation[] => {
  const edits: EditOperation[] = [];
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
    const removableSpecifiers = specifiers.filter((specifier) => {
      if (
        !isObject(specifier) ||
        specifier.type !== 'ImportSpecifier' ||
        !isObject(specifier.local) ||
        !isObject(specifier.imported)
      ) {
        return false;
      }

      const importedName =
        typeof specifier.imported.name === 'string'
          ? specifier.imported.name
          : undefined;
      const localName =
        typeof specifier.local.name === 'string'
          ? specifier.local.name
          : undefined;

      return (
        importedName === 'FontAwesomeIcon' &&
        Boolean(localName && usedLocals.has(localName))
      );
    });

    if (!removableSpecifiers.length) {
      continue;
    }

    const declarationRange = node.range as NodeRange | undefined;
    if (removableSpecifiers.length === specifiers.length && declarationRange) {
      edits.push({
        type: 'remove',
        from: declarationRange[0],
        to: extendToLineEnd(code, declarationRange[1]),
      });
      continue;
    }

    for (const specifier of removableSpecifiers) {
      if (!isObject(specifier)) {
        continue;
      }
      const range = specifier.range as NodeRange | undefined;
      if (!range || range.length !== 2) {
        continue;
      }
      const [from, to] = specifierRemovalRange(code, range);
      edits.push({ type: 'remove', from, to });
    }
  }

  return edits;
};

const extendToLineEnd = (code: string, end: number): number => {
  let to = end;
  while (to < code.length && /[ \t]/.test(code[to])) {
    to += 1;
  }
  if (code[to] === '\r' && code[to + 1] === '\n') {
    return to + 2;
  }
  if (code[to] === '\n') {
    return to + 1;
  }
  return to;
};

const specifierRemovalRange = (
  code: string,
  [start, end]: NodeRange,
): NodeRange => {
  let from = start;
  let to = end;

  let before = start - 1;
  while (before >= 0 && /\s/.test(code[before])) {
    before -= 1;
  }
  if (before >= 0 && code[before] === ',') {
    from = before;
    return [from, to];
  }

  let after = end;
  while (after < code.length && /\s/.test(code[after])) {
    after += 1;
  }
  if (after < code.length && code[after] === ',') {
    to = consumeTrailingWhitespace(code, after + 1);
  }

  return [from, to];
};

const consumeTrailingWhitespace = (code: string, start: number): number => {
  let to = start;
  while (to < code.length && /\s/.test(code[to])) {
    to += 1;
  }
  return to;
};

export const transformModule = (
  code: string,
  id: string,
  register: (pack: string, exportName: string) => void,
  sources: readonly RegExp[] = DEFAULT_ICON_SOURCES,
  options: TransformModuleOptions = {},
): TransformResult => {
  const { sourceMap = false } = options;

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
  const spriteIconImport = findSpriteIconImport(program);

  const usages = detectIconUsage(program, table);
  const fontAwesomeUsages = hasPotentialFontAwesomeUsage
    ? detectFontAwesomeIconUsages(
        program,
        table,
        detectFontAwesomeComponents(program),
      )
    : [];

  if (!usages.length && !fontAwesomeUsages.length) {
    return { code, map: null, anyReplacements: false };
  }

  const used = new Set<string>();
  const usedFontAwesomeComponents = new Set<string>();
  const edits = buildEdits(usages, spriteIconImport.localName, used, register);
  const registeredFontAwesomeIcons = new Set<string>();

  for (const usage of fontAwesomeUsages) {
    edits.push({
      type: 'replace',
      from: usage.componentRange[0],
      to: usage.componentRange[1],
      value: spriteIconImport.localName,
    });
    if (!usage.hasIconId) {
      edits.push({
        type: 'insert',
        pos: usage.componentRange[1],
        value: ` iconId="${computeIconId(usage.pack, usage.exportName)}"`,
      });
    }
    edits.push({
      type: 'remove',
      from: usage.iconAttributeRange[0],
      to: consumeTrailingWhitespace(code, usage.iconAttributeRange[1]),
    });

    used.add(usage.iconLocal);
    usedFontAwesomeComponents.add(usage.componentLocal);
    const key = `${usage.pack}:${usage.exportName}`;
    if (!registeredFontAwesomeIcons.has(key)) {
      registeredFontAwesomeIcons.add(key);
      register(usage.pack, usage.exportName);
    }
  }

  const cleanupEdits = cleanupImports(code, program, table, used);
  const cleanupFontAwesomeEdits = cleanupFontAwesomeComponentImports(
    code,
    program,
    usedFontAwesomeComponents,
  );

  const allEdits = [...edits, ...cleanupEdits, ...cleanupFontAwesomeEdits];

  const magicString = applyEdits(code, allEdits);
  const importPrefix = `import { ${ICON_COMPONENT_NAME} } from "${ICON_SOURCE}";\n`;
  if (!spriteIconImport.hasImport) {
    magicString.prepend(importPrefix);
  }

  return {
    code: magicString.toString(),
    map: sourceMap
      ? magicString.generateMap({ source: id, hires: true })
      : null,
    anyReplacements: true,
  };
};
