import type { SourceMap } from 'magic-string';
import { DEFAULT_ICON_SOURCES } from '../packs/icon-resolvers';
import { normalizePackAlias } from '../utils/compute-icon-id';
import { applyEdits, applyEditsToString } from './edit-applier';
import type { EditOperation } from './edit-builder';
import { fastFilter } from './fast-filter';

export const ICON_SOURCE = 'react-icons-sprite';
export const ICON_COMPONENT_NAME = 'ReactIconsSpriteIcon';

type NodeRange = [number, number];

type IconSymbol = {
  pack: string;
  exportName: string;
  iconId: string;
};

type IconSymbolTable = {
  items: Record<string, IconSymbol | undefined>;
  size: number;
};

const FONTAWESOME_REACT_PACK = '@fortawesome/react-fontawesome';
const HUGEICONS_REACT_PACK = '@hugeicons/react';

const isFontAwesomeIconPack = (pack: string): boolean => {
  return /^@fortawesome\/[\w-]+-svg-icons$/.test(pack);
};

const isHugeiconsIconPack = (pack: string): boolean => {
  return /^@hugeicons\/core-free-icons(?:\/.*)?$/.test(pack);
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

const buildScannedSymbolTable = (imports: ScannedImport[]): IconSymbolTable => {
  const items: Record<string, IconSymbol | undefined> = Object.create(null);
  let size = 0;

  for (const item of imports) {
    const iconIdPrefix = `ri-${normalizePackAlias(item.pack)}-`;
    for (const specifier of item.specifiers) {
      if (items[specifier.local] === undefined) {
        size += 1;
      }
      items[specifier.local] = {
        pack: item.pack,
        exportName: specifier.exportName,
        iconId: iconIdPrefix + specifier.exportName,
      };
    }
  }

  return { items, size };
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

type JsxIconEditScan = {
  edits: EditOperation[];
  count: number;
};

type JsxReferencePropEditScan = {
  edits: EditOperation[];
  count: number;
};

const scanJsxIconEdits = (
  code: string,
  symbols: IconSymbolTable,
  componentName: string,
  usedSymbols: Set<string>,
  register: (pack: string, exportName: string) => void,
  hasAnyIconId: boolean,
): JsxIconEditScan => {
  if (symbols.size === 0) {
    return { edits: [], count: 0 };
  }

  const edits: EditOperation[] = [];
  let count = 0;

  for (
    let index = code.indexOf('<');
    index !== -1;
    index = code.indexOf('<', index + 1)
  ) {
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
    const symbol = symbols.items[local];
    if (!symbol) {
      continue;
    }

    let hasIconId = false;
    if (hasAnyIconId && !closing) {
      const tagEnd = findJsxOpeningTagEnd(code, cursor);
      hasIconId = tagEnd !== -1 && hasIconIdAttribute(code, cursor, tagEnd);
    }

    if (closing || hasIconId) {
      edits.push({
        type: 'replace',
        from: localStart,
        to: cursor,
        value: componentName,
      });
    } else {
      edits.push({
        type: 'replace',
        from: localStart,
        to: cursor,
        value: `${componentName} iconId="${symbol.iconId}"`,
      });
    }

    count += 1;

    if (!closing) {
      usedSymbols.add(local);
      register(symbol.pack, symbol.exportName);
    }
  }

  return { edits, count };
};

const scanJsxReferencePropEdits = (
  code: string,
  symbols: IconSymbolTable,
  componentName: string,
  usedSymbols: Set<string>,
  register: (pack: string, exportName: string) => void,
  ignoredComponentLocals: Set<string>,
): JsxReferencePropEditScan => {
  if (symbols.size === 0) {
    return { edits: [], count: 0 };
  }

  const edits: EditOperation[] = [];
  let count = 0;

  for (
    let index = code.indexOf('<');
    index !== -1;
    index = code.indexOf('<', index + 1)
  ) {
    let cursor = index + 1;
    while (isWhitespace(code[cursor])) {
      cursor += 1;
    }

    if (code[cursor] === '/') {
      continue;
    }

    if (!isIdentifierStart(code[cursor])) {
      continue;
    }

    const componentStart = cursor;
    cursor += 1;
    while (isIdentifierPart(code[cursor])) {
      cursor += 1;
    }

    const componentLocal = code.slice(componentStart, cursor);
    if (
      symbols.items[componentLocal] ||
      ignoredComponentLocals.has(componentLocal)
    ) {
      continue;
    }

    const tagEnd = findJsxOpeningTagEnd(code, cursor);
    if (tagEnd === -1) {
      continue;
    }

    let attributeCursor = cursor;
    while (attributeCursor < tagEnd) {
      while (isWhitespace(code[attributeCursor])) {
        attributeCursor += 1;
      }

      if (attributeCursor >= tagEnd || code[attributeCursor] === '/') {
        break;
      }

      if (code[attributeCursor] === '{') {
        const expressionEnd = findJsxExpressionEnd(code, attributeCursor);
        attributeCursor = expressionEnd === -1 ? tagEnd : expressionEnd + 1;
        continue;
      }

      if (!isIdentifierStart(code[attributeCursor])) {
        attributeCursor += 1;
        continue;
      }

      attributeCursor += 1;
      while (isJsxAttributeNamePart(code[attributeCursor])) {
        attributeCursor += 1;
      }

      while (isWhitespace(code[attributeCursor])) {
        attributeCursor += 1;
      }

      if (code[attributeCursor] !== '=') {
        continue;
      }

      attributeCursor += 1;
      while (isWhitespace(code[attributeCursor])) {
        attributeCursor += 1;
      }

      const valueStart = attributeCursor;
      if (code[valueStart] === '"' || code[valueStart] === "'") {
        attributeCursor = skipQuotedString(code, valueStart);
        continue;
      }

      if (code[valueStart] !== '{') {
        continue;
      }

      const expressionEnd = findJsxExpressionEnd(code, valueStart);
      if (expressionEnd === -1 || expressionEnd > tagEnd) {
        attributeCursor = tagEnd;
        continue;
      }

      attributeCursor = expressionEnd + 1;
      const expression = code.slice(valueStart + 1, expressionEnd);
      const iconMatch = /^(\s*)([A-Za-z_$][\w$]*)(\s*)$/.exec(expression);
      if (!iconMatch) {
        continue;
      }

      const iconLocal = iconMatch[2];
      const symbol = symbols.items[iconLocal];
      if (
        !symbol ||
        isFontAwesomeIconPack(symbol.pack) ||
        isHugeiconsIconPack(symbol.pack)
      ) {
        continue;
      }

      const iconLocalStart = valueStart + 1 + iconMatch[1].length;
      edits.push({
        type: 'replace',
        from: iconLocalStart,
        to: iconLocalStart + iconLocal.length,
        value: `(props) => <${componentName} {...props} iconId="${symbol.iconId}" />`,
      });

      count += 1;
      usedSymbols.add(iconLocal);
      register(symbol.pack, symbol.exportName);
    }
  }

  return { edits, count };
};

const isJsxAttributeNamePart = (char: string | undefined): boolean => {
  return isIdentifierPart(char) || char === '-' || char === '.' || char === ':';
};

const skipQuotedString = (code: string, start: number): number => {
  const quote = code[start];
  let cursor = start + 1;
  while (cursor < code.length) {
    if (code[cursor] === '\\') {
      cursor += 2;
      continue;
    }
    if (code[cursor] === quote) {
      return cursor + 1;
    }
    cursor += 1;
  }
  return code.length;
};

const findJsxExpressionEnd = (code: string, start: number): number => {
  let quote: string | null = null;
  let braceDepth = 0;
  for (let index = start; index < code.length; index += 1) {
    const char = code[index];
    if (quote) {
      if (char === '\\') {
        index += 1;
        continue;
      }
      if (char === quote) {
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
      if (braceDepth === 0) {
        return index;
      }
    }
  }
  return -1;
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
  symbols: IconSymbolTable,
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

    const symbol = symbols.items[iconMatch[1]];
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

type HugeiconsIconUsage = {
  componentLocal: string;
  componentRange: NodeRange;
  iconAttributeRange: NodeRange;
  iconLocal: string;
  pack: string;
  exportName: string;
  iconId: string;
  hasIconId: boolean;
};

const scanHugeiconsComponents = (code: string): Set<string> => {
  const locals = new Set<string>();
  IMPORT_RE.lastIndex = 0;
  for (const match of code.matchAll(IMPORT_RE)) {
    const [, specifier, , source] = match;
    if (source !== HUGEICONS_REACT_PACK) {
      continue;
    }
    const specifiers: ScannedImportSpecifier[] = [];
    parseNamedSpecifiers(
      specifier,
      match.index + match[0].indexOf(specifier),
      specifiers,
    );
    for (const item of specifiers) {
      if (item.exportName === 'HugeiconsIcon') {
        locals.add(item.local);
      }
    }
  }
  return locals;
};

const scanHugeiconsUsages = (
  code: string,
  symbols: IconSymbolTable,
  componentLocals: Set<string>,
): HugeiconsIconUsage[] => {
  if (!componentLocals.size) {
    return [];
  }

  const names = [...componentLocals].map(escapeRegExp).join('|');
  const tagRe = new RegExp(`<\\s*(${names})\\b`, 'g');
  const usages: HugeiconsIconUsage[] = [];

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

    const symbol = symbols.items[iconMatch[1]];
    if (!symbol || !isHugeiconsIconPack(symbol.pack)) {
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
      iconLocal: iconMatch[1],
      pack: symbol.pack,
      exportName: symbol.exportName,
      iconId: symbol.iconId,
      hasIconId: /\biconId\s*=/.test(attributes),
    });
  }

  return usages;
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

const cleanupScannedHugeiconsComponentImports = (
  code: string,
  usedLocals: Set<string>,
): EditOperation[] => {
  const edits: EditOperation[] = [];
  IMPORT_RE.lastIndex = 0;

  for (const match of code.matchAll(IMPORT_RE)) {
    const [statement, specifier, , source] = match;
    if (source !== HUGEICONS_REACT_PACK) {
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
        item.exportName === 'HugeiconsIcon' && usedLocals.has(item.local),
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

const editRange = (edit: EditOperation): NodeRange | null => {
  if (edit.type === 'insert') {
    return null;
  }
  return [edit.from, edit.to];
};

const rangeContains = ([start, end]: NodeRange, index: number): boolean => {
  return index >= start && index < end;
};

const collectUsedLocalsOutsideRanges = (
  code: string,
  usedLocals: Set<string>,
  ignoredRanges: NodeRange[],
): Set<string> => {
  const ranges = [...ignoredRanges].sort((left, right) => left[0] - right[0]);
  const found = new Set<string>();
  let rangeIndex = 0;
  let quote: '"' | "'" | null = null;
  let lineComment = false;
  let blockComment = false;

  for (let index = 0; index < code.length; index += 1) {
    while (rangeIndex < ranges.length && ranges[rangeIndex][1] <= index) {
      rangeIndex += 1;
    }
    const ignoredRange = ranges[rangeIndex];
    if (ignoredRange && rangeContains(ignoredRange, index)) {
      index = ignoredRange[1] - 1;
      continue;
    }

    const char = code[index];
    const next = code[index + 1];

    if (lineComment) {
      if (char === '\n' || char === '\r') {
        lineComment = false;
      }
      continue;
    }

    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false;
        index += 1;
      }
      continue;
    }

    if (quote) {
      if (char === '\\') {
        index += 1;
        continue;
      }
      if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === '/' && next === '/') {
      lineComment = true;
      index += 1;
      continue;
    }

    if (char === '/' && next === '*') {
      blockComment = true;
      index += 1;
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (!isIdentifierStart(char)) {
      continue;
    }

    const start = index;
    index += 1;
    while (isIdentifierPart(code[index])) {
      index += 1;
    }

    const local = code.slice(start, index);
    if (usedLocals.has(local)) {
      found.add(local);
    }
    index -= 1;
  }

  return found;
};

const filterRemovableUsedLocals = (
  code: string,
  imports: ScannedImport[],
  usedLocals: Set<string>,
  usageEdits: EditOperation[],
): Set<string> => {
  const ignoredRanges = [
    ...imports.map((item) => item.declarationRange),
    ...usageEdits.flatMap((edit) => {
      const range = editRange(edit);
      return range ? [range] : [];
    }),
  ];
  const liveLocals = collectUsedLocalsOutsideRanges(
    code,
    usedLocals,
    ignoredRanges,
  );

  const removable = new Set<string>();
  for (const local of usedLocals) {
    if (!liveLocals.has(local)) {
      removable.add(local);
    }
  }

  return removable;
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
  const hasPotentialHugeiconsUsage =
    code.includes(HUGEICONS_REACT_PACK) &&
    scannedImports.some((item) => isHugeiconsIconPack(item.pack));

  const table = buildScannedSymbolTable(scannedImports);
  if (!table.size) {
    return { code, map: null, anyReplacements: false };
  }

  const spriteIconImport = code.includes(ICON_SOURCE)
    ? scanSpriteIconImport(code)
    : { hasImport: false, localName: ICON_COMPONENT_NAME };
  const used = new Set<string>();
  const fontAwesomeComponents = hasPotentialFontAwesomeUsage
    ? scanFontAwesomeComponents(code)
    : new Set<string>();
  const hugeiconsComponents = hasPotentialHugeiconsUsage
    ? scanHugeiconsComponents(code)
    : new Set<string>();
  const usedFontAwesomeComponents = new Set<string>();
  const usedHugeiconsComponents = new Set<string>();
  const ignoredIconPropComponentLocals = new Set([
    ...fontAwesomeComponents,
    ...hugeiconsComponents,
  ]);
  const jsxScan = scanJsxIconEdits(
    code,
    table,
    spriteIconImport.localName,
    used,
    register,
    code.includes('iconId'),
  );
  const referencePropScan = scanJsxReferencePropEdits(
    code,
    table,
    spriteIconImport.localName,
    used,
    register,
    ignoredIconPropComponentLocals,
  );
  const fontAwesomeUsages = hasPotentialFontAwesomeUsage
    ? scanFontAwesomeUsages(code, table, fontAwesomeComponents)
    : [];
  const hugeiconsUsages = hasPotentialHugeiconsUsage
    ? scanHugeiconsUsages(code, table, hugeiconsComponents)
    : [];

  if (
    jsxScan.count === 0 &&
    referencePropScan.count === 0 &&
    !fontAwesomeUsages.length &&
    !hugeiconsUsages.length
  ) {
    return { code, map: null, anyReplacements: false };
  }

  const edits = [...jsxScan.edits, ...referencePropScan.edits];
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

  const registeredHugeiconsIcons = new Set<string>();

  for (const usage of hugeiconsUsages) {
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
    usedHugeiconsComponents.add(usage.componentLocal);
    const key = `${usage.pack}:${usage.exportName}`;
    if (!registeredHugeiconsIcons.has(key)) {
      registeredHugeiconsIcons.add(key);
      register(usage.pack, usage.exportName);
    }
  }

  const removableUsed = filterRemovableUsedLocals(
    code,
    scannedImports,
    used,
    edits,
  );
  const cleanupEdits = cleanupScannedImports(
    code,
    scannedImports,
    removableUsed,
  );
  const cleanupFontAwesomeEdits = usedFontAwesomeComponents.size
    ? cleanupScannedFontAwesomeComponentImports(code, usedFontAwesomeComponents)
    : [];
  const cleanupHugeiconsEdits = usedHugeiconsComponents.size
    ? cleanupScannedHugeiconsComponentImports(code, usedHugeiconsComponents)
    : [];

  const canUsePresortedEdits =
    referencePropScan.count === 0 &&
    cleanupFontAwesomeEdits.length === 0 &&
    cleanupHugeiconsEdits.length === 0;
  const allEdits = canUsePresortedEdits
    ? [...cleanupEdits, ...edits]
    : [
        ...edits,
        ...cleanupEdits,
        ...cleanupFontAwesomeEdits,
        ...cleanupHugeiconsEdits,
      ];
  const importPrefix = `import { ${ICON_COMPONENT_NAME} } from "${ICON_SOURCE}";\n`;

  if (!sourceMap) {
    return {
      code: `${spriteIconImport.hasImport ? '' : importPrefix}${applyEditsToString(
        code,
        allEdits,
        canUsePresortedEdits,
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
