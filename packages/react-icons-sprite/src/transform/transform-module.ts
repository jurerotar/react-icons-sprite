import { parse } from '@babel/parser';
import traverseModule, { type Binding, type NodePath } from '@babel/traverse';
import type { ImportDeclaration, JSXElement, Node } from '@babel/types';
import type { SourceMap } from 'magic-string';
import { DEFAULT_ICON_SOURCES } from '../packs/icon-sources';
import { computeIconId } from '../utils/compute-icon-id';
import { applyEdits, applyEditsToString } from './edit-applier';
import type { EditOperation } from './edit-builder';
import { fastFilter } from './fast-filter';

// Babel's CommonJS entry exposes its visitor as a nested default in Node ESM.
const traverse =
  (traverseModule as unknown as { default: typeof traverseModule }).default ??
  traverseModule;

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

type IconSymbol = { pack: string; exportName: string; iconId: string };
const matches = (sources: readonly RegExp[], pack: string): boolean =>
  sources.some((source) => {
    source.lastIndex = 0;
    return source.test(pack);
  });

const isDefinition = (pack: string): boolean =>
  /^@fortawesome\/[\w-]+-svg-icons$/.test(pack) ||
  /^@hugeicons\/core-free-icons(?:\/.*)?$/.test(pack);

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
  if (!fastFilter(code)) {
    return unchanged;
  }

  let ast: ReturnType<typeof parse>;
  try {
    ast = parse(code, {
      sourceType: 'unambiguous',
      plugins: ['jsx', 'typescript'],
    });
  } catch {
    // Unsupported syntax must remain inline rather than receive partial edits.
    return unchanged;
  }

  const icons = new Map<Binding, IconSymbol>();
  const wrappers = new Map<Binding, string>();
  const imports: NodePath<ImportDeclaration>[] = [];
  const elements: NodePath<JSXElement>[] = [];
  const names = new Set<string>();
  const bindings: Binding[] = [];
  let spriteBinding: Binding | undefined;

  traverse(ast, {
    Identifier(path) {
      names.add(path.node.name);
    },
    JSXIdentifier(path) {
      names.add(path.node.name);
    },
    Scopable(path) {
      bindings.push(...Object.values(path.scope.bindings));
    },
    ImportDeclaration(path) {
      imports.push(path);
      const pack = path.node.source.value;
      for (const specifier of path.node.specifiers) {
        if (
          path.node.importKind === 'type' ||
          (specifier.type === 'ImportSpecifier' &&
            specifier.importKind === 'type')
        ) {
          continue;
        }
        const binding = path.scope.getBinding(specifier.local.name);
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
          });
        }
      }
    },
    JSXElement(path) {
      elements.push(path);
    },
  });
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

  const edits: EditOperation[] = [];
  const replaced: Array<[number, number]> = [];
  const usedImports = new Set<Binding>();
  const directElements = new Set<JSXElement>();
  const replace = (node: Node, value: string) => {
    const [from, to] = range(node);
    edits.push({ type: 'replace', from, to, value });
    replaced.push([from, to]);
  };
  const recordIcon = (binding: Binding, icon: IconSymbol) => {
    usedImports.add(binding);
    register(icon.pack, icon.exportName);
  };
  const elementBinding = (path: NodePath<JSXElement>) => {
    const name = path.node.openingElement.name;
    return name.type === 'JSXIdentifier'
      ? path.scope.getBinding(name.name)
      : undefined;
  };
  const hasIconId = (path: NodePath<JSXElement>) =>
    path.node.openingElement.attributes.some(
      (attr) =>
        attr.type === 'JSXAttribute' &&
        attr.name.type === 'JSXIdentifier' &&
        attr.name.name === 'iconId',
    );

  for (const path of elements) {
    const binding = elementBinding(path);
    const icon = binding && icons.get(binding);
    if (!binding || !icon || isDefinition(icon.pack)) {
      continue;
    }
    const opening = path.node.openingElement;
    replace(
      opening.name,
      hasIconId(path)
        ? componentName
        : `${componentName} iconId="${icon.iconId}"`,
    );
    if (path.node.closingElement) {
      replace(path.node.closingElement.name, componentName);
    }
    directElements.add(path.node);
    recordIcon(binding, icon);
  }

  for (const path of elements) {
    const binding = elementBinding(path);
    if (directElements.has(path.node) || (binding && wrappers.has(binding))) {
      continue;
    }
    for (const attribute of path.node.openingElement.attributes) {
      if (
        attribute.type !== 'JSXAttribute' ||
        attribute.value?.type !== 'JSXExpressionContainer' ||
        attribute.value.expression.type !== 'Identifier'
      ) {
        continue;
      }
      const expression = attribute.value.expression;
      const iconBinding = path.scope.getBinding(expression.name);
      const icon = iconBinding && icons.get(iconBinding);
      if (!iconBinding || !icon || isDefinition(icon.pack)) {
        continue;
      }
      replace(
        expression,
        '(props) => <' +
          componentName +
          ' {...props} iconId="' +
          icon.iconId +
          '" />',
      );
      recordIcon(iconBinding, icon);
    }
  }

  for (const path of elements) {
    const binding = elementBinding(path);
    const wrapper = binding && wrappers.get(binding);
    if (!binding || !wrapper) {
      continue;
    }
    const opening = path.node.openingElement;
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
    const iconBinding = path.scope.getBinding(attribute.value.expression.name);
    const icon = iconBinding && icons.get(iconBinding);
    if (
      !iconBinding ||
      !icon ||
      !isDefinition(icon.pack) ||
      (wrapper === '@hugeicons/react') !== icon.pack.startsWith('@hugeicons/')
    ) {
      continue;
    }
    replace(
      opening.name,
      hasIconId(path)
        ? componentName
        : `${componentName} iconId="${icon.iconId}"`,
    );
    if (path.node.closingElement) {
      replace(path.node.closingElement.name, componentName);
    }
    const [from, end] = range(attribute);
    let to = end;
    while (/\s/.test(code[to] ?? '') && to < code.length) {
      to++;
    }
    edits.push({ type: 'remove', from, to });
    replaced.push([from, to]);
    usedImports.add(binding);
    recordIcon(iconBinding, icon);
  }
  if (!edits.length) {
    return unchanged;
  }

  for (const path of imports) {
    const declaration = path.node;
    const kept = declaration.specifiers.filter((specifier) => {
      const binding = path.scope.getBinding(specifier.local.name);
      return (
        !binding ||
        !usedImports.has(binding) ||
        binding.referencePaths.some((reference) => {
          const [start, end] = range(reference.node);
          return !replaced.some(([from, to]) => start >= from && end <= to);
        })
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
      ast.program.directives.at(-1)?.end ?? ast.program.interpreter?.end ?? 0;
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
