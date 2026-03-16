import { type ComponentType, createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import MagicString from 'magic-string';
import { parseSync, Visitor } from 'oxc-parser';
import type { JSXOpeningElement, JSXClosingElement } from '@oxc-project/types';

export const ICON_SOURCE = 'react-icons-sprite';
export const ICON_COMPONENT_NAME = 'ReactIconsSpriteIcon';

// Built-in supported React icon package sources (exact or regex patterns)
// Only packages exporting individual React components are listed.
export const DEFAULT_ICON_SOURCES: ReadonlyArray<RegExp> = [
  /^react-icons\/[\w-]+$/, // react-icons packs
  /^lucide-react$/, // Lucide
  /^@radix-ui\/react-icons$/, // Radix Icons
  /^@heroicons\/react(?:\/.*)?$/, // Heroicons v1/v2 subpaths
  /^@tabler\/icons-react$/, // Tabler
  /^phosphor-react$/, // Phosphor
  /^@phosphor-icons\/react$/, // Phosphor
  /^react-feather$/, // Feather (react binding)
  /^react-bootstrap-icons$/, // Bootstrap Icons (react binding)
  /^grommet-icons$/, // Grommet
  /^@remixicon\/react$/, // Remix Icons React
  /^devicons-react$/, // Devicons React
  /^@fortawesome\/react-fontawesome$/, // Font Awesome
  /^@fortawesome\/[\w-]+-svg-icons$/, // Font Awesome (Pro or Free)
  /^@hugeicons\/react$/, // Hugeicons React wrapper
  /^@hugeicons(?:-pro)?\/[\w-]+$/, // Hugeicons icon packs
  /^@mui\/icons-material(?:\/.*)?$/, // MUI Icons
  /^@carbon\/icons-react$/, // Carbon Icons
];

const sourceMatchesSupported = (
  source: string,
  sources = DEFAULT_ICON_SOURCES,
) => sources.some((re) => re.test(source));

const normalizeAlias = (pack: string): string => {
  // Remove leading @, replace non-alphanumeric chars with '-'
  const withoutScope = pack.replace(/^@/, '');
  // Current implementation: '@mui/icons-material/Alarm' -> 'mui-icons-material-Alarm'
  return withoutScope.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '');
};

export const computeIconId = (pack: string, exportName: string): string => {
  const alias = normalizeAlias(pack);
  return `ri-${alias}-${exportName}`;
};

type SourceMapLike = {
  version: number;
  file?: string;
  sources: string[];
  sourcesContent?: string[];
  names: string[];
  mappings: string;
};

export type IconImport = {
  pack: string;
  exportName: string;
  decl: unknown;
  spec: unknown;
};

type ParseResult = ReturnType<typeof parseSync>;
type OxcProgram = ParseResult['program'];
type OxcNode = {
  type?: string;
  range?: [number, number];
  start?: number;
  end?: number;
  [key: string]: unknown;
};

const getRange = (node: OxcNode): [number, number] | null => {
  if (Array.isArray(node.range) && node.range.length === 2) {
    return [node.range[0], node.range[1]];
  }
  if (typeof node.start === 'number' && typeof node.end === 'number') {
    return [node.start, node.end];
  }
  return null;
};

const getParseLangCandidates = (
  filename: string,
): Array<'js' | 'jsx' | 'ts' | 'tsx'> => {
  const clean = filename.split('?', 1)[0] ?? filename;
  const lower = clean.toLowerCase();

  if (lower.endsWith('.tsx')) {
    return ['tsx', 'ts', 'jsx', 'js'];
  }
  if (lower.endsWith('.ts')) {
    return ['ts', 'tsx', 'js', 'jsx'];
  }
  if (lower.endsWith('.jsx')) {
    return ['jsx', 'js', 'tsx', 'ts'];
  }
  return ['js', 'jsx', 'ts', 'tsx'];
};

const parseAst = (code: string, filename: string): ParseResult => {
  const languages = getParseLangCandidates(filename);

  let firstResult: ParseResult | undefined;

  for (const lang of languages) {
    const result = parseSync(filename, code, {
      lang,
      sourceType: 'module',
      range: true,
    });

    firstResult ??= result;
    if (result.errors.length === 0) {
      return result;
    }
  }

  return (
    firstResult ??
    parseSync(filename, code, {
      lang: 'tsx',
      sourceType: 'module',
      range: true,
    })
  );
};

const collectIconImports = (
  program: OxcProgram,
  sources: ReadonlyArray<RegExp> = DEFAULT_ICON_SOURCES,
): Map<string, IconImport> => {
  const map = new Map<string, IconImport>();
  const body = (program as unknown as { body?: OxcNode[] }).body ?? [];

  for (const node of body) {
    if (node.type !== 'ImportDeclaration') {
      continue;
    }
    const sourceNode = node.source as { value?: string } | undefined;
    const pack = sourceNode?.value;
    if (
      typeof pack !== 'string' ||
      !sourceMatchesSupported(pack, sources) ||
      node.importKind === 'type'
    ) {
      continue;
    }

    const specifiers = (node.specifiers as OxcNode[] | undefined) ?? [];
    for (const spec of specifiers) {
      if (spec.type === 'ImportSpecifier') {
        if (spec.importKind === 'type') {
          continue;
        }
        const imported = spec.imported as { type?: string; name?: string };
        const local = spec.local as { type?: string; name?: string };
        if (
          imported?.type === 'Identifier' &&
          local?.type === 'Identifier' &&
          imported.name &&
          local.name
        ) {
          map.set(local.name, {
            pack,
            exportName: imported.name,
            decl: node,
            spec,
          });
        }
      } else if (spec.type === 'ImportDefaultSpecifier') {
        const local = spec.local as { type?: string; name?: string };
        if (local?.type === 'Identifier' && local.name) {
          map.set(local.name, {
            pack,
            exportName: 'default',
            decl: node,
            spec,
          });
        }
      }
    }
  }

  return map;
};

const findExistingIconImport = (program: OxcProgram) => {
  let iconLocalName = ICON_COMPONENT_NAME;
  let hasIconImport = false;
  const body = (program as unknown as { body?: OxcNode[] }).body ?? [];

  for (const node of body) {
    if (node.type !== 'ImportDeclaration') {
      continue;
    }
    const sourceNode = node.source as { value?: string } | undefined;
    if (sourceNode?.value !== ICON_SOURCE) {
      continue;
    }
    const specifiers = (node.specifiers as OxcNode[] | undefined) ?? [];
    for (const spec of specifiers) {
      if (spec.type !== 'ImportSpecifier') {
        continue;
      }
      const imported = spec.imported as { type?: string; name?: string };
      if (
        imported?.type === 'Identifier' &&
        imported.name === ICON_COMPONENT_NAME
      ) {
        hasIconImport = true;
        const local = spec.local as
          | { type?: string; name?: string }
          | undefined;
        iconLocalName =
          local?.type === 'Identifier' && local.name
            ? local.name
            : ICON_COMPONENT_NAME;
        break;
      }
    }
    if (hasIconImport) {
      break;
    }
  }

  return { hasIconImport, iconLocalName };
};

const removeImportSpecifier = (
  ms: MagicString,
  code: string,
  spec: OxcNode,
) => {
  const range = getRange(spec);
  if (!range) {
    return;
  }

  const [start, end] = range;
  let from = start;
  let to = end;

  let i = start - 1;
  while (i >= 0 && /\s/.test(code[i])) {
    i -= 1;
  }
  if (i >= 0 && code[i] === ',') {
    from = i;
  } else {
    let j = end;
    while (j < code.length && /\s/.test(code[j])) {
      j += 1;
    }
    if (j < code.length && code[j] === ',') {
      to = j + 1;
    }
  }
  ms.remove(from, to);
};

const removeEntireImport = (ms: MagicString, code: string, decl: OxcNode) => {
  const range = getRange(decl);
  if (!range) {
    return;
  }

  let [from, to] = range;
  while (to < code.length && /[ \t]/.test(code[to])) {
    to += 1;
  }
  if (code[to] === '\r' && code[to + 1] === '\n') {
    to += 2;
  } else if (code[to] === '\n') {
    to += 1;
  }
  ms.remove(from, to);
};

const fixIconSelfClosingSpacing = (
  outputCode: string,
  iconLocalName: string,
) => {
  const re = new RegExp(`<${iconLocalName}([^>]*?)/>`, 'g');
  return outputCode.replace(re, (_match, attrs: string) => {
    const normalizedAttrs = attrs.replace(/\s+$/g, '');
    return `<${iconLocalName}${normalizedAttrs} />`;
  });
};

type TransformResult = {
  code: string;
  map: SourceMapLike | null;
  anyReplacements: boolean;
};

type TransformModuleOptions = {
  sourceMap?: boolean;
};

export const transformModule = (
  code: string,
  id: string,
  register: (pack: string, exportName: string) => void,
  sources: ReadonlyArray<RegExp> = DEFAULT_ICON_SOURCES,
  options: TransformModuleOptions = {},
): TransformResult => {
  const { sourceMap = false } = options;
  const parsed = parseAst(code, id);
  if (parsed.errors.length > 0) {
    throw new Error(parsed.errors[0]?.message ?? `Failed to parse: ${id}`);
  }

  const { program } = parsed;
  const localNameToImport = collectIconImports(program, sources);
  if (localNameToImport.size === 0) {
    return { code, map: null, anyReplacements: false };
  }

  const { hasIconImport, iconLocalName } = findExistingIconImport(program);
  const ms = new MagicString(code);
  const usedLocalNames = new Set<string>();
  let anyReplacements = false;

  const visitor = new Visitor({
    JSXOpeningElement(node: JSXOpeningElement) {
      const name = node.name as unknown as OxcNode | undefined;
      if (name?.type !== 'JSXIdentifier') {
        return;
      }
      const local = (name as { name?: string }).name;
      if (!local || local === iconLocalName) {
        return;
      }
      const meta = localNameToImport.get(local);
      if (!meta) {
        return;
      }

      let iconPack = meta.pack;
      let iconExport = meta.exportName;
      let usedLocal = local;

      const attrs = (node.attributes as unknown as OxcNode[] | undefined) ?? [];
      let hasIconId = false;
      let iconAttr: OxcNode | undefined;
      for (const a of attrs) {
        if (a.type !== 'JSXAttribute') {
          continue;
        }
        const attrName = a.name as { type?: string; name?: string } | undefined;
        if (attrName?.type === 'JSXIdentifier' && attrName.name === 'iconId') {
          hasIconId = true;
        }
        if (attrName?.type === 'JSXIdentifier' && attrName.name === 'icon') {
          iconAttr = a;
        }
      }

      if (
        ((meta.pack === '@fortawesome/react-fontawesome' &&
          meta.exportName === 'FontAwesomeIcon') ||
          (meta.pack === '@hugeicons/react' &&
            meta.exportName === 'HugeiconsIcon')) &&
        iconAttr
      ) {
        const value = iconAttr.value as OxcNode | undefined;
        if (value?.type === 'JSXExpressionContainer') {
          const expr = value.expression as OxcNode | undefined;
          if (expr?.type === 'Identifier') {
            const iconLocal = (expr as { name?: string }).name;
            if (iconLocal) {
              const iconMeta = localNameToImport.get(iconLocal);
              if (iconMeta) {
                iconPack = iconMeta.pack;
                iconExport = iconMeta.exportName;
                usedLocal = iconLocal;
                const iconAttrRange = getRange(iconAttr);
                if (iconAttrRange) {
                  let [from, to] = iconAttrRange;
                  while (to < code.length && /\s/.test(code[to])) {
                    to += 1;
                  }
                  ms.remove(from, to);
                }
              }
            }
          }
        }
      }

      const nameRange = getRange(name);
      if (nameRange) {
        ms.overwrite(nameRange[0], nameRange[1], iconLocalName);
      }

      if (!hasIconId) {
        const idValue = computeIconId(iconPack, iconExport);
        const insertPos = nameRange?.[1];
        if (typeof insertPos === 'number') {
          ms.appendLeft(insertPos, ` iconId="${idValue}"`);
        }
      }

      usedLocalNames.add(local);
      if (usedLocal !== local) {
        usedLocalNames.add(usedLocal);
      }
      anyReplacements = true;
      register(iconPack, iconExport);
    },

    JSXClosingElement(node: JSXClosingElement) {
      const name = node.name as unknown as OxcNode | undefined;
      if (name?.type !== 'JSXIdentifier') {
        return;
      }
      const local = (name as { name?: string }).name;
      if (!local || local === iconLocalName) {
        return;
      }
      const meta = localNameToImport.get(local);
      if (!meta) {
        return;
      }
      const nameRange = getRange(name);
      if (nameRange) {
        ms.overwrite(nameRange[0], nameRange[1], iconLocalName);
      }
    },
  });
  visitor.visit(program);

  if (!anyReplacements) {
    return { code, map: null, anyReplacements: false };
  }

  const declToAllSpecs = new Map<OxcNode, OxcNode[]>();
  const declToUsedSpecs = new Map<OxcNode, OxcNode[]>();
  for (const { decl, spec } of localNameToImport.values()) {
    const declNode = decl as OxcNode;
    const specNode = spec as OxcNode;

    const all = declToAllSpecs.get(declNode) ?? [];
    if (all.length === 0) {
      const specifiers = (declNode.specifiers as OxcNode[] | undefined) ?? [];
      for (const oneSpec of specifiers) {
        if (
          oneSpec.type === 'ImportSpecifier' ||
          oneSpec.type === 'ImportDefaultSpecifier'
        ) {
          all.push(oneSpec);
        }
      }
      declToAllSpecs.set(declNode, all);
    }

    const localName = specNode.local as { name?: string } | undefined;
    if (!localName?.name || !usedLocalNames.has(localName.name)) {
      continue;
    }

    const used = declToUsedSpecs.get(declNode) ?? [];
    used.push(specNode);
    declToUsedSpecs.set(declNode, used);
  }

  for (const [declNode, usedSpecs] of declToUsedSpecs.entries()) {
    const allSpecs = declToAllSpecs.get(declNode) ?? [];
    if (allSpecs.length > 0 && usedSpecs.length >= allSpecs.length) {
      removeEntireImport(ms, code, declNode);
      continue;
    }

    const byStartDesc = [...usedSpecs].sort((a, b) => {
      const aRange = getRange(a);
      const bRange = getRange(b);
      if (!aRange || !bRange) {
        return 0;
      }
      return bRange[0] - aRange[0];
    });

    for (const usedSpec of byStartDesc) {
      removeImportSpecifier(ms, code, usedSpec);
    }
  }

  if (!hasIconImport) {
    ms.prepend(`import { ${iconLocalName} } from "${ICON_SOURCE}";\n`);
  }

  const transformedCode = ms.toString();
  const outCode = transformedCode.includes(`<${iconLocalName}`)
    ? fixIconSelfClosingSpacing(transformedCode, iconLocalName)
    : transformedCode;
  const map = sourceMap
    ? (() => {
        const rawMap = ms.generateMap({
          source: id,
          includeContent: true,
          hires: true,
        }) as unknown as SourceMapLike;
        return {
          ...rawMap,
          sourcesContent: rawMap.sourcesContent?.map(
            (sourceContent) => sourceContent ?? '',
          ),
        } as SourceMapLike;
      })()
    : null;

  return {
    code: outCode,
    map,
    anyReplacements,
  };
};

const PRESENTATION_ATTRS = new Set([
  'fill',
  'stroke',
  'stroke-width',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-miterlimit',
  'stroke-dasharray',
  'stroke-dashoffset',
  'stroke-opacity',
  'fill-rule',
  'fill-opacity',
  'color',
  'opacity',
  'shape-rendering',
  'vector-effect',
]);

const ATTR_RE = /([a-zA-Z_:.-]+)\s*=\s*"([^"]*)"/g;

interface FontAwesomeIconObject {
  icon: [number, number, string[], string, string | string[]];
}

interface HugeiconsIconObject {
  viewBox?: string;
  paths?: Array<{
    d?: string;
    opacity?: number;
  }>;
}

type HugeiconsArrayIcon = Array<[string, Record<string, string | number>]>;

type IconModule = Record<string, unknown>;

const toKebab = (s: string) =>
  s
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();

const resolveSpecificImportPath = (
  pack: string,
  exportName: string,
): string | null => {
  // - MUI Icons: @mui/icons-material/Alarm
  if (/^@mui\/icons-material(?:\/.*)?$/.test(pack)) {
    // If already specific subpath (e.g., @mui/icons-material/Alarm), just return it
    if (pack.split('/').length > 2) {
      return pack;
    }
    return `${pack}/${exportName}`;
  }
  // - Radix Icons: @radix-ui/react-icons/SunIcon
  if (/^@radix-ui\/react-icons$/.test(pack)) {
    return `${pack}/${exportName}`;
  }
  // - Heroicons v2: @heroicons/react/24/(outline|solid)/BellIcon
  if (/^@heroicons\/react\/(?:\d{2})\/(?:outline|solid)$/.test(pack)) {
    return `${pack}/${exportName}`;
  }
  // - Font Awesome icon objects: @fortawesome/free-solid-svg-icons/faCoffee
  if (/^@fortawesome\/[\w-]+-svg-icons$/.test(pack)) {
    return `${pack}/${exportName}`;
  }
  // - lucide-react: lucide-react/icons/circle (kebab-case)
  if (/^lucide-react$/.test(pack)) {
    return `${pack}/icons/${toKebab(exportName)}`;
  }
  // - @phosphor-icons/react: @phosphor-icons/react/dist/ssr/Alarm.es.js
  if (/^@phosphor-icons\/react$/.test(pack)) {
    return `${pack}/dist/ssr/${exportName}.es.js`;
  }
  // - phosphor-react: phosphor-react/dist/icons/Alarm.esm.js
  if (/^phosphor-react$/.test(pack)) {
    return `${pack}/dist/icons/${exportName}.esm.js`;
  }
  // - @tabler/icons-react: @tabler/icons-react/dist/esm/icons/IconAlarm.mjs
  if (/^@tabler\/icons-react$/.test(pack)) {
    return `${pack}/dist/esm/icons/${exportName}.mjs`;
  }
  // - react-feather: react-feather/dist/icons/alarm (kebab-case)
  if (/^react-feather$/.test(pack)) {
    return `${pack}/dist/icons/${toKebab(exportName)}`;
  }
  // - react-bootstrap-icons: react-bootstrap-icons/dist/icons/alarm (kebab-case)
  if (/^react-bootstrap-icons$/.test(pack)) {
    return `${pack}/dist/icons/${toKebab(exportName)}`;
  }
  // - @carbon/icons-react: @carbon/icons-react/lib/<IconName>.js
  if (/^@carbon\/icons-react$/.test(pack)) {
    return `${pack}/lib/${exportName}.js`;
  }
  // Many other packs either do not expose per-icon paths or have unstable paths.
  return null;
};

export const renderOneIcon = async (pack: string, exportName: string) => {
  let mod: IconModule;
  // Prefer importing a specific icon path when available to avoid pulling entire icon sets.
  // If that fails, gracefully fall back to importing the whole pack.
  const specificPath = resolveSpecificImportPath(pack, exportName);
  if (specificPath) {
    try {
      mod = (await import(/* @vite-ignore */ specificPath)) as IconModule;
      // Some specific paths default-export the component/object
      if (mod && 'default' in mod && Object.keys(mod).length === 1) {
        // Normalize to named for downstream logic
        (mod as Record<string, unknown>)[exportName] = (
          mod as {
            default: unknown;
          }
        ).default;
      }
    } catch {
      // Fall back to importing the whole pack if specific path is unavailable in this environment
      mod = (await import(/* @vite-ignore */ pack)) as IconModule;
    }
  } else {
    mod = (await import(/* @vite-ignore */ pack)) as IconModule;
  }

  const modRecord = mod as Record<string, unknown>;
  const Comp = modRecord[exportName] ?? modRecord.default;

  if (!Comp) {
    throw new Error(`Icon export not found: ${pack} -> ${exportName}`);
  }

  const id = computeIconId(pack, exportName);

  // Special handling for FontAwesome icons which are objects, not components
  if (pack.includes('fortawesome')) {
    const faIcon = Comp as FontAwesomeIconObject;
    const [width, height, , , pathData] = faIcon.icon;
    const viewBox = `0 0 ${width} ${height}`;
    const paths = Array.isArray(pathData) ? pathData : [pathData];
    const inner = paths.map((d: string) => `<path d="${d}" />`).join('');
    const symbol = `<symbol id="${id}" viewBox="${viewBox}">${inner}</symbol>`;
    return { id, symbol };
  }

  // Hugeicons exports icon objects consumed by HugeiconsIcon wrapper
  if (/^@hugeicons(?:-pro)?\/[\w-]+$/.test(pack)) {
    if (Array.isArray(Comp)) {
      const hugeIcon = Comp as HugeiconsArrayIcon;
      const inner = hugeIcon
        .map(([tag, attrs]) => {
          const attrString = Object.entries(attrs)
            .map(([k, v]) => `${k}="${v}"`)
            .join(' ');
          return `<${tag} ${attrString} />`;
        })
        .join('');
      const symbol = `<symbol id="${id}" viewBox="0 0 24 24">${inner}</symbol>`;
      return { id, symbol };
    }
    const hugeIcon = Comp as HugeiconsIconObject;
    const viewBox = hugeIcon.viewBox ?? '0 0 24 24';
    const paths = Array.isArray(hugeIcon.paths) ? hugeIcon.paths : [];
    const inner = paths
      .map((p) => {
        if (!p?.d) {
          return '';
        }
        const opacityAttr =
          typeof p.opacity === 'number' ? ` opacity="${p.opacity}"` : '';
        return `<path d="${p.d}"${opacityAttr} />`;
      })
      .join('');
    const symbol = `<symbol id="${id}" viewBox="${viewBox}">${inner}</symbol>`;
    return { id, symbol };
  }

  // If it's a FontAwesomeIcon-like object, createElement will fail.
  // Grommet-icons can fail if rendered without any props.
  const html = renderToStaticMarkup(createElement(Comp as ComponentType, {}));

  const viewBox = html.match(/viewBox="([^"]+)"/i)?.[1] ?? '0 0 24 24';
  const svgAttrsRaw = html.match(/^<svg\b([^>]*)>/i)?.[1] ?? '';

  const attrs: string[] = [];
  for (const [, k, v] of svgAttrsRaw.matchAll(ATTR_RE)) {
    const key = k.toLowerCase();
    if (PRESENTATION_ATTRS.has(key)) {
      attrs.push(`${key}="${v}"`);
    }
  }

  const inner = html
    .replace(/^<svg[^>]*>/i, '')
    .replace(/<\/svg>\s*$/i, '')
    .replace(/<svg[^>]*>/gi, '')
    .replace(/<\/svg>/gi, '');
  const stylePart = attrs.length ? ` ${attrs.join(' ')}` : '';
  const symbol = `<symbol id="${id}" viewBox="${viewBox}"${stylePart}>${inner}</symbol>`;

  return {
    id,
    symbol,
  };
};

export const buildSprite = async (
  icons: Iterable<{ pack: string; exportName: string }>,
): Promise<string> => {
  const rendered = await Promise.all(
    Array.from(icons).map(({ pack, exportName }) =>
      renderOneIcon(pack, exportName),
    ),
  );
  const symbols = rendered.map((r) => r.symbol).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg"><defs>${symbols}</defs></svg>`;
};

type Pack = {
  pack: string;
  exportName: string;
};

export const createCollector = () => {
  const set = new Map<string, Pack>();

  return {
    add(pack: string, exportName: string): void {
      set.set(`${pack}:${exportName}`, { pack, exportName });
    },
    toList(): Pack[] {
      return Array.from(set.values());
    },
    clear(): void {
      set.clear();
    },
  };
};
