import type { SourceMap } from 'magic-string';
import { DEFAULT_ICON_SOURCES } from '../packs/icon-resolvers';
import { computeIconId, normalizePackAlias } from '../utils/compute-icon-id';
import { applyEdits, applyEditsToString } from './edit-applier';
import { buildEdits, type EditOperation, type IconUsage } from './edit-builder';
import { fastFilter } from './fast-filter';

export const ICON_SOURCE = 'react-icons-sprite';
export const ICON_COMPONENT_NAME = 'ReactIconsSpriteIcon';

type NodeRange = [number, number];

type IconSymbol = {
  pack: string;
  exportName: string;
  iconId: string;
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

type ScannedImportSpecifier = {
  local: string;
  exportName: string;
  range: NodeRange;
};

type ScannedImport = {
  pack: string;
  declarationRange: NodeRange;
  specifiers: ScannedImportSpecifier[];
  specifierCount: number;
};

type SpriteIconImport = {
  hasImport: boolean;
  localName: string;
};

const sourceMatches = (source: RegExp, pack: string): boolean => {
  source.lastIndex = 0;
  return source.test(pack);
};

const IMPORT_RE = /import\s+([^;]+?)\s+from\s+(['"])([^'"]+)\2\s*;?/g;

const trimRange = (value: string, offset: number): NodeRange | null => {
  let start = 0;
  let end = value.length;
  while (start < end && /\s/.test(value[start])) {
    start += 1;
  }
  while (end > start && /\s/.test(value[end - 1])) {
    end -= 1;
  }
  return start === end ? null : [offset + start, offset + end];
};

const parseNamedSpecifiers = (
  specifier: string,
  specifierOffset: number,
  imports: ScannedImportSpecifier[],
): void => {
  const start = specifier.indexOf('{');
  const end = specifier.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    return;
  }

  let segmentStart = start + 1;
  for (let index = start + 1; index <= end; index += 1) {
    if (index !== end && specifier[index] !== ',') {
      continue;
    }

    const segment = specifier.slice(segmentStart, index);
    const range = trimRange(segment, specifierOffset + segmentStart);
    segmentStart = index + 1;
    if (!range) {
      continue;
    }

    const text = specifier.slice(
      range[0] - specifierOffset,
      range[1] - specifierOffset,
    );
    if (text.startsWith('type ')) {
      continue;
    }

    const aliasMatch = /^(.*?)\s+as\s+([A-Za-z_$][\w$]*)$/.exec(text);
    const exportName = aliasMatch ? aliasMatch[1].trim() : text.trim();
    const local = aliasMatch ? aliasMatch[2] : exportName;
    if (exportName && local) {
      imports.push({ local, exportName, range });
    }
  }
};

const countImportSpecifiers = (specifier: string): number => {
  let count = 0;
  const braceStart = specifier.indexOf('{');
  const defaultPart =
    braceStart === -1 ? specifier : specifier.slice(0, braceStart);
  const defaultText = defaultPart.replace(/,$/, '').trim();
  if (defaultText) {
    count += 1;
  }

  const braceEnd = specifier.lastIndexOf('}');
  if (braceStart !== -1 && braceEnd > braceStart) {
    const named = specifier.slice(braceStart + 1, braceEnd);
    for (const segment of named.split(',')) {
      if (segment.trim()) {
        count += 1;
      }
    }
  }

  return count;
};

const scanImportsDetailed = (
  code: string,
  sources: readonly RegExp[],
): ScannedImport[] => {
  const imports: ScannedImport[] = [];
  IMPORT_RE.lastIndex = 0;

  for (const match of code.matchAll(IMPORT_RE)) {
    const [statement, specifier, , pack] = match;
    if (!sources.some((source) => sourceMatches(source, pack))) {
      continue;
    }

    const normalizedSpecifier = specifier.trim();
    if (normalizedSpecifier.startsWith('type ')) {
      continue;
    }

    const matchStart = match.index;
    const specifierOffset = matchStart + statement.indexOf(specifier);
    const specifiers: ScannedImportSpecifier[] = [];
    const braceStart = specifier.indexOf('{');
    const defaultPart =
      braceStart === -1 ? specifier : specifier.slice(0, braceStart);
    const defaultText = defaultPart.replace(/,$/, '');
    const defaultRange = trimRange(defaultText, specifierOffset);
    if (
      defaultRange &&
      !specifier
        .slice(
          defaultRange[0] - specifierOffset,
          defaultRange[1] - specifierOffset,
        )
        .startsWith('type ')
    ) {
      const local = specifier.slice(
        defaultRange[0] - specifierOffset,
        defaultRange[1] - specifierOffset,
      );
      if (local && /^[A-Za-z_$][\w$]*$/.test(local)) {
        specifiers.push({ local, exportName: 'default', range: defaultRange });
      }
    }

    parseNamedSpecifiers(specifier, specifierOffset, specifiers);
    if (specifiers.length) {
      imports.push({
        pack,
        declarationRange: [matchStart, matchStart + statement.length],
        specifiers,
        specifierCount: countImportSpecifiers(specifier),
      });
    }
  }

  return imports;
};

const buildScannedSymbolTable = (
  imports: ScannedImport[],
): Map<string, IconSymbol> => {
  const table = new Map<string, IconSymbol>();
  for (const item of imports) {
    const iconIdPrefix = `ri-${normalizePackAlias(item.pack)}-`;
    for (const specifier of item.specifiers) {
      table.set(specifier.local, {
        pack: item.pack,
        exportName: specifier.exportName,
        iconId: iconIdPrefix + specifier.exportName,
      });
    }
  }
  return table;
};

const scanSpriteIconImport = (code: string): SpriteIconImport => {
  IMPORT_RE.lastIndex = 0;
  for (const match of code.matchAll(IMPORT_RE)) {
    const [, specifier, , source] = match;
    if (source !== ICON_SOURCE) {
      continue;
    }
    const specifiers: ScannedImportSpecifier[] = [];
    parseNamedSpecifiers(
      specifier,
      match.index + match[0].indexOf(specifier),
      specifiers,
    );
    for (const item of specifiers) {
      if (item.exportName === ICON_COMPONENT_NAME) {
        return { hasImport: true, localName: item.local };
      }
    }
  }
  return { hasImport: false, localName: ICON_COMPONENT_NAME };
};

const escapeRegExp = (value: string): string => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const isIdentifierStart = (char: string | undefined): boolean => {
  return (
    char !== undefined &&
    ((char >= 'A' && char <= 'Z') ||
      (char >= 'a' && char <= 'z') ||
      char === '_' ||
      char === '$')
  );
};

const isIdentifierPart = (char: string | undefined): boolean => {
  return (
    char !== undefined &&
    (isIdentifierStart(char) || (char >= '0' && char <= '9'))
  );
};

const isWhitespace = (char: string | undefined): boolean => {
  return (
    char === ' ' ||
    char === '\t' ||
    char === '\n' ||
    char === '\r' ||
    char === '\f'
  );
};

const isWhitespaceCode = (code: number): boolean => {
  return code === 32 || code === 9 || code === 10 || code === 13 || code === 12;
};

const scanJsxIconUsages = (
  code: string,
  symbols: Map<string, IconSymbol>,
  hasAnyIconId: boolean,
): IconUsage[] => {
  if (!symbols.size) {
    return [];
  }

  const usages: IconUsage[] = [];

  for (let index = 0; index < code.length; index += 1) {
    if (code.charCodeAt(index) !== 60) {
      continue;
    }

    let cursor = index + 1;
    while (isWhitespace(code[cursor])) {
      cursor += 1;
    }

    const closing = code[cursor] === '/';
    if (closing) {
      cursor += 1;
      while (isWhitespace(code[cursor])) {
        cursor += 1;
      }
    }

    if (!isIdentifierStart(code[cursor])) {
      continue;
    }

    const localStart = cursor;
    cursor += 1;
    while (isIdentifierPart(code[cursor])) {
      cursor += 1;
    }

    const local = code.slice(localStart, cursor);
    const symbol = symbols.get(local);
    if (!symbol) {
      continue;
    }

    const kind = closing ? 'closing' : 'opening';
    let hasIconId = false;
    if (hasAnyIconId && !closing) {
      const tagEnd = findJsxOpeningTagEnd(code, cursor);
      hasIconId = tagEnd !== -1 && hasIconIdAttribute(code, cursor, tagEnd);
    }

    usages.push({
      local,
      range: [localStart, cursor],
      pack: symbol.pack,
      exportName: symbol.exportName,
      iconId: symbol.iconId,
      kind,
      hasIconId,
    });
  }

  return usages;
};

const hasIconIdAttribute = (
  code: string,
  start: number,
  end: number,
): boolean => {
  for (let index = start; index < end; index += 1) {
    if (
      code.charCodeAt(index) !== 105 ||
      code.charCodeAt(index + 1) !== 99 ||
      code.charCodeAt(index + 2) !== 111 ||
      code.charCodeAt(index + 3) !== 110 ||
      code.charCodeAt(index + 4) !== 73 ||
      code.charCodeAt(index + 5) !== 100
    ) {
      continue;
    }

    if (
      isIdentifierPart(code[index - 1]) ||
      isIdentifierPart(code[index + 6])
    ) {
      continue;
    }

    let cursor = index + 6;
    while (isWhitespace(code[cursor])) {
      cursor += 1;
    }
    if (code[cursor] === '=') {
      return true;
    }
  }
  return false;
};

const findJsxOpeningTagEnd = (code: string, start: number): number => {
  let quote: string | null = null;
  let braceDepth = 0;
  for (let index = start; index < code.length; index += 1) {
    const char = code[index];
    if (quote) {
      if (char === quote && code[index - 1] !== '\\') {
        quote = null;
      }
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }
    if (char === '{') {
      braceDepth += 1;
      continue;
    }
    if (char === '}') {
      braceDepth -= 1;
      continue;
    }
    if (char === '>' && braceDepth === 0) {
      return index;
    }
  }
  return -1;
};

const scanFontAwesomeComponents = (code: string): Set<string> => {
  const locals = new Set<string>();
  IMPORT_RE.lastIndex = 0;
  for (const match of code.matchAll(IMPORT_RE)) {
    const [, specifier, , source] = match;
    if (source !== FONTAWESOME_REACT_PACK) {
      continue;
    }
    const specifiers: ScannedImportSpecifier[] = [];
    parseNamedSpecifiers(
      specifier,
      match.index + match[0].indexOf(specifier),
      specifiers,
    );
    for (const item of specifiers) {
      if (item.exportName === 'FontAwesomeIcon') {
        locals.add(item.local);
      }
    }
  }
  return locals;
};

const scanFontAwesomeUsages = (
  code: string,
  symbols: Map<string, IconSymbol>,
  componentLocals: Set<string>,
): FontAwesomeIconUsage[] => {
  if (!componentLocals.size) {
    return [];
  }

  const names = [...componentLocals].map(escapeRegExp).join('|');
  const tagRe = new RegExp(`<\\s*(${names})\\b`, 'g');
  const usages: FontAwesomeIconUsage[] = [];

  for (const match of code.matchAll(tagRe)) {
    const componentLocal = match[1];
    const componentStart = match.index + match[0].lastIndexOf(componentLocal);
    const tagEnd = findJsxOpeningTagEnd(
      code,
      componentStart + componentLocal.length,
    );
    if (tagEnd === -1) {
      continue;
    }

    const attributes = code.slice(
      componentStart + componentLocal.length,
      tagEnd,
    );
    const iconMatch = /\sicon\s*=\s*\{\s*([A-Za-z_$][\w$]*)\s*\}/.exec(
      attributes,
    );
    if (!iconMatch || iconMatch.index === undefined) {
      continue;
    }

    const symbol = symbols.get(iconMatch[1]);
    if (!symbol || !isFontAwesomeIconPack(symbol.pack)) {
      continue;
    }

    const attributeStart =
      componentStart + componentLocal.length + iconMatch.index;
    usages.push({
      componentLocal,
      componentRange: [componentStart, componentStart + componentLocal.length],
      iconAttributeRange: [
        attributeStart,
        attributeStart + iconMatch[0].length,
      ],
      hasIconId: /\biconId\s*=/.test(attributes),
      iconLocal: iconMatch[1],
      pack: symbol.pack,
      exportName: symbol.exportName,
      iconId: symbol.iconId,
    });
  }

  return usages;
};

type FontAwesomeIconUsage = {
  componentLocal: string;
  componentRange: NodeRange;
  iconAttributeRange: NodeRange;
  hasIconId: boolean;
  iconLocal: string;
  pack: string;
  exportName: string;
  iconId: string;
};

const cleanupScannedImports = (
  code: string,
  imports: ScannedImport[],
  usedLocals: Set<string>,
): EditOperation[] => {
  const edits: EditOperation[] = [];

  for (const item of imports) {
    const usedSpecifiers = item.specifiers.filter((specifier) =>
      usedLocals.has(specifier.local),
    );
    if (!usedSpecifiers.length) {
      continue;
    }

    if (
      usedSpecifiers.length === item.specifiers.length &&
      item.specifierCount === item.specifiers.length
    ) {
      edits.push({
        type: 'remove',
        from: item.declarationRange[0],
        to: extendToLineEnd(code, item.declarationRange[1]),
      });
      continue;
    }

    for (const specifier of usedSpecifiers) {
      const [from, to] = specifierRemovalRange(code, specifier.range);
      edits.push({ type: 'remove', from, to });
    }
  }

  return edits;
};

const cleanupScannedFontAwesomeComponentImports = (
  code: string,
  usedLocals: Set<string>,
): EditOperation[] => {
  const edits: EditOperation[] = [];
  IMPORT_RE.lastIndex = 0;

  for (const match of code.matchAll(IMPORT_RE)) {
    const [statement, specifier, , source] = match;
    if (source !== FONTAWESOME_REACT_PACK) {
      continue;
    }

    const specifiers: ScannedImportSpecifier[] = [];
    parseNamedSpecifiers(
      specifier,
      match.index + statement.indexOf(specifier),
      specifiers,
    );
    const removableSpecifiers = specifiers.filter(
      (item) =>
        item.exportName === 'FontAwesomeIcon' && usedLocals.has(item.local),
    );
    if (!removableSpecifiers.length) {
      continue;
    }

    if (removableSpecifiers.length === specifiers.length) {
      edits.push({
        type: 'remove',
        from: match.index,
        to: extendToLineEnd(code, match.index + statement.length),
      });
      continue;
    }

    for (const specifier of removableSpecifiers) {
      const [from, to] = specifierRemovalRange(code, specifier.range);
      edits.push({ type: 'remove', from, to });
    }
  }

  return edits;
};

const extendToLineEnd = (code: string, end: number): number => {
  let to = end;
  while (to < code.length) {
    const char = code.charCodeAt(to);
    if (char !== 32 && char !== 9) {
      break;
    }
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
  while (before >= 0 && isWhitespaceCode(code.charCodeAt(before))) {
    before -= 1;
  }
  if (before >= 0 && code[before] === ',') {
    from = before;
    return [from, to];
  }

  let after = end;
  while (after < code.length && isWhitespaceCode(code.charCodeAt(after))) {
    after += 1;
  }
  if (after < code.length && code[after] === ',') {
    to = consumeTrailingWhitespace(code, after + 1);
  }

  return [from, to];
};

const consumeTrailingWhitespace = (code: string, start: number): number => {
  let to = start;
  while (to < code.length && isWhitespaceCode(code.charCodeAt(to))) {
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

  const scannedImports = scanImportsDetailed(code, sources);
  if (!scannedImports.length) {
    return { code, map: null, anyReplacements: false };
  }

  const hasPotentialFontAwesomeUsage =
    code.includes(FONTAWESOME_REACT_PACK) &&
    scannedImports.some((item) => isFontAwesomeIconPack(item.pack));

  const table = buildScannedSymbolTable(scannedImports);
  if (!table.size) {
    return { code, map: null, anyReplacements: false };
  }

  const spriteIconImport = code.includes(ICON_SOURCE)
    ? scanSpriteIconImport(code)
    : { hasImport: false, localName: ICON_COMPONENT_NAME };
  const usages = scanJsxIconUsages(code, table, code.includes('iconId'));
  const fontAwesomeUsages = hasPotentialFontAwesomeUsage
    ? scanFontAwesomeUsages(code, table, scanFontAwesomeComponents(code))
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
        value: ` iconId="${usage.iconId}"`,
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

  const cleanupEdits = cleanupScannedImports(code, scannedImports, used);
  const cleanupFontAwesomeEdits = usedFontAwesomeComponents.size
    ? cleanupScannedFontAwesomeComponentImports(code, usedFontAwesomeComponents)
    : [];

  const allEdits = [...edits, ...cleanupEdits, ...cleanupFontAwesomeEdits];
  const importPrefix = `import { ${ICON_COMPONENT_NAME} } from "${ICON_SOURCE}";\n`;

  if (!sourceMap) {
    return {
      code: `${spriteIconImport.hasImport ? '' : importPrefix}${applyEditsToString(
        code,
        allEdits,
      )}`,
      map: null,
      anyReplacements: true,
    };
  }

  const magicString = applyEdits(code, allEdits);
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
