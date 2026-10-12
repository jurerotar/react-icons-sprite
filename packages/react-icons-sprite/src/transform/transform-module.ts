import type { Program, ImportDeclaration, JSXElement, Node } from 'oxc-parser';
import type { SourceMap } from 'magic-string';
import { DEFAULT_ICON_SOURCES } from '../packs/icon-sources';
import { computeIconId } from '../utils/compute-icon-id';
import { applyEdits, applyEditsToString } from './edit-applier';
import type { EditOperation } from './edit-builder';
import { fastFilter } from './fast-filter';
import { createModuleParser } from './parse-module';
import {
  analyzeModule,
  getBinding as lookupBinding,
  type Binding,
  type ScopedNode,
} from './analyze-module';

const getBinding = lookupBinding;
const parseModule = createModuleParser();

export const ICON_SOURCE = 'react-icons-sprite';
export const ICON_COMPONENT_NAME = 'ReactIconsSpriteIcon';

type TransformResult = {
  code: string;
  map: SourceMap | null;
  anyReplacements: boolean;
};

type TransformModuleOptions = {
  sourceMap?: boolean;
  excludedSources?: readonly RegExp[];
};

type IconSymbol = {
  pack: string;
  exportName: string;
  iconId: string;
  definition: boolean;
  openingReplacement: string;
  referenceReplacement: string;
};
const matches = (sources: readonly RegExp[], pack: string): boolean =>
  sources.some((source) => {
    source.lastIndex = 0;
    return source.test(pack);
  });

const isDefinition = (pack: string): boolean =>
  /^@fortawesome\/[\w-]+-svg-icons$/.test(pack) ||
  /^@hugeicons\/core-free-icons(?:\/.*)?$/.test(pack);

// Only a conservative hint: exact matching and decoding still happen later.
const defaultSourceHints = DEFAULT_ICON_SOURCES.map((source) => {
  const pattern = source.source;
  let prefix = '';
  for (let index = 1; index < pattern.length; index++) {
    const char = pattern[index];
    if (char === '(' || char === '[' || char === '$') {
      break;
    }
    if (char === '\\' && pattern[index + 1] === '/') {
      index++;
    }
    prefix += pattern[index];
  }
  return prefix;
});

const hasPossibleIconSource = (
  code: string,
  sources: readonly RegExp[],
  excluded: readonly RegExp[],
): boolean => {
  // Escaped package names need the parser to decode them. Otherwise inspect
  // every quote independently: quotes in comments cannot hide a real import.
  if (code.includes('\\')) {
    return true;
  }
  if (
    sources === DEFAULT_ICON_SOURCES &&
    !defaultSourceHints.some((hint) => code.includes(hint))
  ) {
    return false;
  }
  for (let index = 0; index < code.length; index++) {
    const quote = code[index];
    if (quote !== '"' && quote !== "'") {
      continue;
    }
    const end = code.indexOf(quote, index + 1);
    if (end === -1) {
      continue;
    }
    const candidate = code.slice(index + 1, end);
    if (matches(sources, candidate) && !matches(excluded, candidate)) {
      return true;
    }
  }
  return false;
};

const range = (node: Node): [number, number] => [node.start!, node.end!];
const importedName = (node: ImportDeclaration['specifiers'][number]): string =>
  node.type === 'ImportDefaultSpecifier'
    ? 'default'
    : node.type === 'ImportSpecifier'
      ? node.imported.type === 'Identifier'
        ? node.imported.name
        : node.imported.value
      : '*';

export const transformModule = (
  code: string,
  id: string,
  register: (pack: string, exportName: string) => void,
  sources: readonly RegExp[] = DEFAULT_ICON_SOURCES,
  options: TransformModuleOptions = {},
): TransformResult => {
  const unchanged = { code, map: null, anyReplacements: false };
  if (
    !fastFilter(code) ||
    !hasPossibleIconSource(code, sources, options.excludedSources ?? [])
  ) {
    return unchanged;
  }

  let ast: Program;
  try {
    const parsed = parseModule(id, code);
    if (!parsed) {
      return unchanged;
    }
    ast = parsed;
  } catch {
    // Unsupported syntax must remain inline rather than receive partial edits.
    return unchanged;
  }

  if (
    !ast.body.some(
      (node) =>
        node.type === 'ImportDeclaration' &&
        matches(sources, node.source.value) &&
        !matches(options.excludedSources ?? [], node.source.value),
    )
  ) {
    return unchanged;
  }

  const icons = new Map<Binding, IconSymbol>();
  const wrappers = new Map<Binding, string>();
  const { imports, elements, names, bindings } = analyzeModule(ast);
  let spriteBinding: Binding | undefined;
  for (const path of imports) {
    const pack = path.node.source.value;
    for (const specifier of path.node.specifiers) {
      if (
        path.node.importKind === 'type' ||
        (specifier.type === 'ImportSpecifier' &&
          specifier.importKind === 'type')
      ) {
        continue;
      }
      const binding = getBinding(path.scope, specifier.local.name);
      if (!binding || specifier.type === 'ImportNamespaceSpecifier') {
        continue;
      }
      const exportName = importedName(specifier);
      if (pack === ICON_SOURCE && exportName === ICON_COMPONENT_NAME) {
        spriteBinding = binding;
      }
      if (
        (pack === '@fortawesome/react-fontawesome' &&
          exportName === 'FontAwesomeIcon') ||
        (pack === '@hugeicons/react' && exportName === 'HugeiconsIcon')
      ) {
        wrappers.set(binding, pack);
      }
      if (
        matches(sources, pack) &&
        !matches(options.excludedSources ?? [], pack)
      ) {
        icons.set(binding, {
          pack,
          exportName,
          iconId: computeIconId(pack, exportName),
          definition: isDefinition(pack),
          openingReplacement: '',
          referenceReplacement: '',
        });
      }
    }
  }
  if (!icons.size) {
    return unchanged;
  }

  let componentName = spriteBinding?.identifier.name ?? ICON_COMPONENT_NAME;
  const reuseSprite =
    spriteBinding &&
    !bindings.some(
      (binding) =>
        binding !== spriteBinding && binding.identifier.name === componentName,
    );
  if (!reuseSprite) {
    let suffix = 0;
    while (names.has(componentName)) {
      componentName = ICON_COMPONENT_NAME + ++suffix;
    }
  }

  for (const icon of icons.values()) {
    icon.openingReplacement = `${componentName} iconId="${icon.iconId}"`;
    icon.referenceReplacement = `(props) => <${componentName} {...props} iconId="${icon.iconId}" />`;
  }

  const edits: EditOperation[] = [];
  const replaced = new Set<Node>();
  const usedImports = new Set<Binding>();
  const registrations: IconSymbol[][] = [[], [], []];
  const replace = (node: Node, value: string) => {
    edits.push({ type: 'replace', from: node.start, to: node.end, value });
    replaced.add(node);
  };

  const elementBinding = (path: ScopedNode<JSXElement>) => {
    const name = path.node.openingElement.name;
    return name.type === 'JSXIdentifier'
      ? getBinding(path.scope, name.name)
      : undefined;
  };
  const hasIconId = (path: ScopedNode<JSXElement>) =>
    path.node.openingElement.attributes.some(
      (attr) =>
        attr.type === 'JSXAttribute' &&
        attr.name.type === 'JSXIdentifier' &&
        attr.name.name === 'iconId',
    );

  // Inspect each element once. Callback buckets preserve the existing order:
  // direct components, component references, then definition wrappers.
  for (const path of elements) {
    const binding = elementBinding(path);
    const opening = path.node.openingElement;
    const direct = binding && icons.get(binding);
    if (binding && direct && !direct.definition) {
      replace(
        opening.name,
        hasIconId(path) ? componentName : direct.openingReplacement,
      );
      if (path.node.closingElement) {
        replace(path.node.closingElement.name, componentName);
      }
      usedImports.add(binding);
      registrations[0].push(direct);
      continue;
    }
    const wrapper = binding && wrappers.get(binding);
    if (binding && wrapper) {
      const attribute = opening.attributes.find(
        (attr) =>
          attr.type === 'JSXAttribute' &&
          attr.name.type === 'JSXIdentifier' &&
          attr.name.name === 'icon',
      );
      if (
        attribute?.type !== 'JSXAttribute' ||
        attribute.value?.type !== 'JSXExpressionContainer' ||
        attribute.value.expression.type !== 'Identifier'
      ) {
        continue;
      }
      const iconBinding = getBinding(
        path.scope,
        attribute.value.expression.name,
      );
      const icon = iconBinding && icons.get(iconBinding);
      if (
        !iconBinding ||
        !icon?.definition ||
        (wrapper === '@hugeicons/react') !== icon.pack.startsWith('@hugeicons/')
      ) {
        continue;
      }
      replace(
        opening.name,
        hasIconId(path) ? componentName : icon.openingReplacement,
      );
      if (path.node.closingElement) {
        replace(path.node.closingElement.name, componentName);
      }
      let to = attribute.end;
      while (/\s/.test(code[to] ?? '') && to < code.length) {
        to++;
      }
      edits.push({ type: 'remove', from: attribute.start, to });
      replaced.add(attribute.value.expression);
      usedImports.add(binding);
      usedImports.add(iconBinding);
      registrations[2].push(icon);
      continue;
    }
    for (const attribute of opening.attributes) {
      if (
        attribute.type !== 'JSXAttribute' ||
        attribute.value?.type !== 'JSXExpressionContainer' ||
        attribute.value.expression.type !== 'Identifier'
      ) {
        continue;
      }
      const expression = attribute.value.expression;
      const iconBinding = getBinding(path.scope, expression.name);
      const icon = iconBinding && icons.get(iconBinding);
      if (!iconBinding || !icon || icon.definition) {
        continue;
      }
      replace(expression, icon.referenceReplacement);
      usedImports.add(iconBinding);
      registrations[1].push(icon);
    }
  }
  for (const bucket of registrations) {
    for (const icon of bucket) {
      register(icon.pack, icon.exportName);
    }
  }
  if (!edits.length) {
    return unchanged;
  }

  for (const path of imports) {
    const declaration = path.node;
    const kept = declaration.specifiers.filter((specifier) => {
      const binding = getBinding(path.scope, specifier.local.name);
      return (
        !binding ||
        !usedImports.has(binding) ||
        binding.references.some((reference) => !replaced.has(reference))
      );
    });
    if (kept.length === declaration.specifiers.length) {
      continue;
    }
    if (!kept.length) {
      const [from, end] = range(declaration);
      let to = end;
      while (code[to] === ' ' || code[to] === '\t' || code[to] === '\r') {
        to++;
      }
      if (code[to] === '\n') {
        to++;
      }
      edits.push({ type: 'remove', from, to });
    } else {
      const ordinary = kept
        .filter((spec) => spec.type !== 'ImportSpecifier')
        .map((spec) => code.slice(...range(spec)));
      const named = kept
        .filter((spec) => spec.type === 'ImportSpecifier')
        .map((spec) => code.slice(...range(spec)));
      if (named.length) {
        ordinary.push(`{ ${named.join(', ')} }`);
      }
      edits.push({
        type: 'replace',
        from: declaration.start! + 6,
        to: declaration.source.start!,
        value: ` ${ordinary.join(', ')} from `,
      });
    }
  }

  if (!reuseSprite) {
    const specifier =
      componentName === ICON_COMPONENT_NAME
        ? ICON_COMPONENT_NAME
        : `${ICON_COMPONENT_NAME} as ${componentName}`;
    const pos =
      ast.body
        .filter(
          (node) => node.type === 'ExpressionStatement' && 'directive' in node,
        )
        .at(-1)?.end ??
      ast.hashbang?.end ??
      0;
    edits.push({
      type: 'insert',
      pos,
      value:
        (pos ? '\n' : '') +
        'import { ' +
        specifier +
        ' } from "' +
        ICON_SOURCE +
        '";\n',
    });
  }
  if (!options.sourceMap) {
    return {
      code: applyEditsToString(code, edits),
      map: null,
      anyReplacements: true,
    };
  }
  const result = applyEdits(code, edits);
  return {
    code: result.toString(),
    map: result.generateMap({ source: id, hires: true }),
    anyReplacements: true,
  };
};
