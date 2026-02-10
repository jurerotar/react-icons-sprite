import { type ComponentType, createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as t from '@babel/types';
import { parse } from '@babel/parser';
import traverse, { type NodePath } from '@babel/traverse';
import generate, { type GeneratorResult } from '@babel/generator';

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
  /^@mui\/icons-material(?:\/.*)?$/, // MUI Icons
  /^@iconscout\/react-unicons$/, // Unicons
];

const sourceMatchesSupported = (
  source: string,
  sources = DEFAULT_ICON_SOURCES,
) => sources.some((re) => re.test(source));

const normalizeAlias = (pack: string): string => {
  // Remove leading @, replace non-alphanumeric chars with '-'
  const withoutScope = pack.replace(/^@/, '');
  // Special case for subpaths: we want to keep some distinction or just flatten?
  // Current implementation: '@mui/icons-material/Alarm' -> 'mui-icons-material-Alarm'
  return withoutScope.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '');
};

export const computeIconId = (pack: string, exportName: string): string => {
  const alias = normalizeAlias(pack);
  return `ri-${alias}-${exportName}`;
};

export type IconImport = {
  pack: string;
  exportName: string;
  decl: t.ImportDeclaration;
  spec: t.ImportSpecifier | t.ImportDefaultSpecifier;
};

const parseAst = (code: string, filename = 'module.tsx'): t.File => {
  return parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
    sourceFilename: filename,
  });
};

export const collectIconImports = (
  ast: t.File,
  sources: ReadonlyArray<RegExp> = DEFAULT_ICON_SOURCES,
): Map<string, IconImport> => {
  const map = new Map<string, IconImport>();
  for (const node of ast.program.body) {
    if (
      t.isImportDeclaration(node) &&
      sourceMatchesSupported(node.source.value, sources) &&
      node.importKind !== 'type'
    ) {
      const pack = node.source.value;
      for (const spec of node.specifiers) {
        if (
          t.isImportSpecifier(spec) &&
          t.isIdentifier(spec.imported) &&
          t.isIdentifier(spec.local) &&
          spec.importKind !== 'type'
        ) {
          const exportName = spec.imported.name;
          const localName = spec.local.name;
          map.set(localName, { pack, exportName, decl: node, spec });
        } else if (
          t.isImportDefaultSpecifier(spec) &&
          t.isIdentifier(spec.local)
        ) {
          const exportName = 'default';
          const localName = spec.local.name;
          map.set(localName, { pack, exportName, decl: node, spec });
        }
      }
    }
  }
  return map;
};

const findExistingIconImport = (ast: t.File) => {
  let iconLocalName = ICON_COMPONENT_NAME;
  let hasIconImport = false;

  for (const n of ast.program.body) {
    if (t.isImportDeclaration(n) && n.source.value === ICON_SOURCE) {
      for (const s of n.specifiers) {
        if (
          t.isImportSpecifier(s) &&
          t.isIdentifier(s.imported, { name: ICON_COMPONENT_NAME })
        ) {
          hasIconImport = true;
          iconLocalName = t.isIdentifier(s.local)
            ? s.local.name
            : ICON_COMPONENT_NAME;
          break;
        }
      }
      if (hasIconImport) {
        break;
      }
    }
  }

  return {
    hasIconImport,
    iconLocalName,
  };
};

const replaceJsxWithSprite = (
  ast: t.File,
  localNameToImport: Map<string, IconImport>,
  iconLocalName: string,
  register: (pack: string, exportName: string) => void,
) => {
  const usedLocalNames = new Set<string>();
  let anyReplacements = false;

  const isAlreadyIcon = (
    name: t.JSXIdentifier | t.JSXMemberExpression | t.JSXNamespacedName,
  ) => t.isJSXIdentifier(name) && name.name === iconLocalName;

  traverse(ast, {
    JSXOpeningElement(path: NodePath<t.JSXOpeningElement>) {
      const name = path.node.name;
      if (!t.isJSXIdentifier(name)) {
        return;
      }

      const local = name.name;
      const meta = localNameToImport.get(local);
      if (!meta) {
        return;
      }
      if (isAlreadyIcon(name)) {
        return;
      }

      let iconPack = meta.pack;
      let iconExport = meta.exportName;
      let usedLocal = local;

      // Special handling for FontAwesomeIcon
      if (
        meta.pack === '@fortawesome/react-fontawesome' &&
        meta.exportName === 'FontAwesomeIcon'
      ) {
        const iconAttr = path.node.attributes.find(
          (a) =>
            t.isJSXAttribute(a) && t.isJSXIdentifier(a.name, { name: 'icon' }),
        ) as t.JSXAttribute | undefined;

        if (
          iconAttr &&
          t.isJSXExpressionContainer(iconAttr.value) &&
          t.isIdentifier(iconAttr.value.expression)
        ) {
          const iconLocalName = iconAttr.value.expression.name;
          const iconMeta = localNameToImport.get(iconLocalName);
          if (iconMeta) {
            iconPack = iconMeta.pack;
            iconExport = iconMeta.exportName;
            usedLocal = iconLocalName;
            // Remove the icon prop as it's no longer needed for our sprite icon
            path.node.attributes = path.node.attributes.filter(
              (a) => a !== iconAttr,
            );
          }
        }
      }

      // Swap tag name
      path.node.name = t.jSXIdentifier(iconLocalName);

      // Add iconId if missing
      const hasIconId = path.node.attributes.some(
        (a) =>
          t.isJSXAttribute(a) && t.isJSXIdentifier(a.name, { name: 'iconId' }),
      );
      if (!hasIconId) {
        const idValue = computeIconId(iconPack, iconExport);
        path.node.attributes.unshift(
          t.jSXAttribute(t.jSXIdentifier('iconId'), t.stringLiteral(idValue)),
        );
      }

      usedLocalNames.add(local);
      if (usedLocal !== local) {
        usedLocalNames.add(usedLocal);
      }
      anyReplacements = true;
      register(iconPack, iconExport);
    },

    JSXClosingElement(path: NodePath<t.JSXClosingElement>) {
      const name = path.node.name;
      if (!t.isJSXIdentifier(name)) {
        return;
      }
      const local = name.name;
      if (!localNameToImport.has(local)) {
        return;
      }
      if (!isAlreadyIcon(name)) {
        path.node.name = t.jSXIdentifier(iconLocalName);
      }
    },
  });

  return {
    usedLocalNames,
    anyReplacements,
  };
};

const insertIconImport = (
  ast: t.File,
  iconLocalName: string = ICON_COMPONENT_NAME,
): void => {
  const firstImportIndex = ast.program.body.findIndex((n) =>
    t.isImportDeclaration(n),
  );
  const iconImportDecl = t.importDeclaration(
    [
      t.importSpecifier(
        t.identifier(iconLocalName),
        t.identifier(ICON_COMPONENT_NAME),
      ),
    ],
    t.stringLiteral(ICON_SOURCE),
  );
  if (firstImportIndex >= 0) {
    ast.program.body.splice(firstImportIndex + 1, 0, iconImportDecl);
  } else {
    ast.program.body.unshift(iconImportDecl);
  }
};

const pruneUsedSpecifiers = (
  ast: t.File,
  localNameToImport: Map<string, IconImport>,
  usedLocalNames: Set<string>,
) => {
  for (const { decl } of new Set([...localNameToImport.values()])) {
    decl.specifiers = decl.specifiers.filter((s) => {
      if (
        (t.isImportSpecifier(s) || t.isImportDefaultSpecifier(s)) &&
        t.isIdentifier(s.local)
      ) {
        return !usedLocalNames.has(s.local.name);
      }
      return true;
    });
  }
  ast.program.body = ast.program.body.filter(
    (n) => !t.isImportDeclaration(n) || n.specifiers.length > 0,
  );
};

const generateCode = (ast: t.File, origCode: string, id: string) => {
  const { code, map } = generate(
    ast,
    { sourceMaps: true, sourceFileName: id },
    origCode,
  );

  return {
    code,
    map,
  };
};

export const transformModule = (
  code: string,
  id: string,
  register: (pack: string, exportName: string) => void,
  sources: ReadonlyArray<RegExp> = DEFAULT_ICON_SOURCES,
): GeneratorResult & { anyReplacements: boolean } => {
  const ast = parseAst(code, id);
  const localNameToImport = collectIconImports(ast, sources);
  if (localNameToImport.size === 0) {
    return { code, map: null, anyReplacements: false };
  }

  const { hasIconImport, iconLocalName } = findExistingIconImport(ast);
  const { usedLocalNames, anyReplacements } = replaceJsxWithSprite(
    ast,
    localNameToImport,
    iconLocalName,
    register,
  );

  if (!anyReplacements) {
    return { code, map: null, anyReplacements: false };
  }

  if (!hasIconImport) {
    insertIconImport(ast, iconLocalName);
  }

  pruneUsedSpecifiers(ast, localNameToImport, usedLocalNames);

  return {
    ...generateCode(ast, code, id),
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

type IconModule = Record<string, unknown>;

export const renderOneIcon = async (pack: string, exportName: string) => {
  let mod: IconModule;
  try {
    mod = (await import(/* @vite-ignore */ pack)) as IconModule;
  } catch (err) {
    console.warn(`Failed to import icon pack ${pack}, skipping.`, err);
    return { id: computeIconId(pack, exportName), symbol: '' };
  }

  let Comp = mod[exportName];

  // Special handling for FontAwesome icons which are objects, not components
  if (
    pack.includes('fortawesome') &&
    Comp &&
    typeof Comp === 'object' &&
    'icon' in Comp &&
    Array.isArray((Comp as FontAwesomeIconObject).icon)
  ) {
    const faIcon = Comp as FontAwesomeIconObject;
    const [width, height, , , pathData] = faIcon.icon;
    const viewBox = `0 0 ${width} ${height}`;
    const id = computeIconId(pack, exportName);
    const paths = Array.isArray(pathData) ? pathData : [pathData];
    const inner = paths.map((d: string) => `<path d="${d}" />`).join('');
    const symbol = `<symbol id="${id}" viewBox="${viewBox}">${inner}</symbol>`;
    return { id, symbol };
  }

  // Handle default exports or interop
  if (
    Comp &&
    typeof Comp === 'object' &&
    'default' in Comp &&
    !('$$typeof' in Comp)
  ) {
    Comp = (Comp as { default: unknown }).default;
  }

  if (!Comp) {
    throw new Error(`Icon export not found: ${pack} -> ${exportName}`);
  }

  const id = computeIconId(pack, exportName);
  let html: string;
  try {
    // If it's a FontAwesomeIcon-like object, createElement will fail.
    html = renderToStaticMarkup(createElement(Comp as ComponentType));
  } catch (err) {
    console.warn(
      `Failed to render icon ${exportName} from ${pack}, skipping.`,
      err,
    );
    return { id, symbol: '' };
  }

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
