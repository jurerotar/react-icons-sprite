import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Node, Program } from 'oxc-parser';
import { createModuleParser } from '../transform/parse-module';

type StaticValue =
  | null
  | boolean
  | number
  | string
  | StaticValue[]
  | { [name: string]: StaticValue };
type Recipe = {
  factoryFile: string;
  factoryExport: string;
  args: StaticValue[];
};
type Factory = (...args: StaticValue[]) => unknown;

const createSourceReader = () => {
  let active = 0;
  const waiting: Array<() => void> = [];
  return async (file: string): Promise<string> => {
    if (active < 32) {
      active++;
    } else {
      await new Promise<void>((resolve) => waiting.push(resolve));
    }
    try {
      return await readFile(file, 'utf8');
    } finally {
      const next = waiting.shift();
      if (next) {
        // Transfer the slot directly so a new request cannot overtake the queue.
        next();
      } else {
        active--;
      }
    }
  };
};

const literalValue = (node: Node): StaticValue => {
  if (
    node.type === 'Literal' &&
    (node.value === null ||
      typeof node.value === 'string' ||
      typeof node.value === 'boolean' ||
      (typeof node.value === 'number' && Number.isFinite(node.value)))
  ) {
    return node.value;
  }
  if (node.type === 'ArrayExpression') {
    return node.elements.map((element) => {
      if (!element) {
        throw new Error('Array hole');
      }
      return literalValue(element);
    });
  }
  if (node.type === 'ObjectExpression') {
    const value: { [name: string]: StaticValue } = {};
    for (const property of node.properties) {
      if (
        property.type !== 'Property' ||
        property.computed ||
        property.method ||
        property.shorthand ||
        property.kind !== 'init'
      ) {
        throw new Error('Dynamic property');
      }
      const name =
        property.key.type === 'Identifier'
          ? property.key.name
          : literalValue(property.key);
      if (
        (typeof name !== 'string' && typeof name !== 'number') ||
        name === '__proto__'
      ) {
        throw new Error('Unsupported property');
      }
      value[name] = literalValue(property.value);
    }
    return value;
  }
  if (
    node.type === 'UnaryExpression' &&
    (node.operator === '-' || node.operator === '+')
  ) {
    const value = literalValue(node.argument);
    if (typeof value === 'number') {
      return node.operator === '-' ? -value : value;
    }
  }
  throw new Error('Dynamic value');
};

const lucideRecipe = (
  program: Program,
  file: string,
  requestedExport: string,
): Recipe | null => {
  let factoryName: string | undefined;
  let factoryFile: string | undefined;
  let dataName: string | undefined;
  let data: StaticValue | undefined;
  let componentName: string | undefined;
  let args: StaticValue[] | undefined;
  let hasDefault = false;
  for (const node of program.body) {
    if (
      node.type === 'ImportDeclaration' &&
      !factoryName &&
      /^\.\.\/createLucideIcon\.(?:mjs|js)$/.test(node.source.value) &&
      node.specifiers.length === 1 &&
      node.specifiers[0].type === 'ImportDefaultSpecifier'
    ) {
      factoryName = node.specifiers[0].local.name;
      factoryFile = path.resolve(path.dirname(file), node.source.value);
    } else if (
      node.type === 'VariableDeclaration' &&
      node.kind === 'const' &&
      node.declarations.length === 1
    ) {
      const declaration = node.declarations[0];
      if (declaration.id.type !== 'Identifier' || !declaration.init) {
        return null;
      }
      const init = declaration.init;
      if (
        (init.type === 'ObjectExpression' || init.type === 'ArrayExpression') &&
        !dataName &&
        !componentName
      ) {
        dataName = declaration.id.name;
        data = literalValue(init);
      } else if (
        init.type === 'CallExpression' &&
        init.callee.type === 'Identifier' &&
        init.callee.name === factoryName &&
        !componentName &&
        init.arguments.length > 0
      ) {
        componentName = declaration.id.name;
        args = init.arguments.map((argument) => {
          if (
            argument.type === 'Identifier' &&
            argument.name === dataName &&
            data !== undefined
          ) {
            return data;
          }
          return literalValue(argument);
        });
      } else {
        return null;
      }
    } else if (
      node.type === 'ExpressionStatement' &&
      node.expression.type === 'MemberExpression' &&
      !node.expression.computed &&
      node.expression.object.type === 'Identifier' &&
      node.expression.object.name === dataName &&
      node.expression.property.type === 'Identifier' &&
      node.expression.property.name === 'node'
    ) {
      // Some releases retain this unused access to the static data object.
    } else if (
      node.type === 'ExportNamedDeclaration' &&
      !node.source &&
      !node.declaration
    ) {
      for (const specifier of node.specifiers) {
        if (
          specifier.local.type !== 'Identifier' ||
          (specifier.local.name !== componentName &&
            specifier.local.name !== dataName)
        ) {
          return null;
        }
        const exported =
          specifier.exported.type === 'Identifier'
            ? specifier.exported.name
            : specifier.exported.value;
        if (
          exported === requestedExport &&
          specifier.local.name !== componentName
        ) {
          return null;
        }
        if (exported === 'default') {
          if (specifier.local.name !== componentName) {
            return null;
          }
          hasDefault = true;
        }
      }
    } else {
      return null;
    }
  }
  return hasDefault && factoryFile && args
    ? { factoryFile, factoryExport: 'default', args }
    : null;
};

const readReactIconsPack = (source: string): Map<string, string> | null => {
  const header =
    /^\s*\/\/ THIS FILE IS AUTO GENERATED\r?\nimport \{ GenIcon \} from ['"]\.\.\/lib\/index\.mjs['"];\s*/.exec(
      source,
    );
  if (!header) {
    return null;
  }
  const functions =
    /export function ([A-Z][\w$]*)\s*\(props\)\s*\{\s*return GenIcon\((\{[^\r\n]*\})\)\(props\);\s*\};\s*/y;
  const definitions = new Map<string, string>();
  let position = header[0].length;
  while (position < source.length) {
    functions.lastIndex = position;
    const match = functions.exec(source);
    if (!match || definitions.has(match[1])) {
      return null;
    }
    definitions.set(match[1], match[2]);
    position = functions.lastIndex;
  }
  return definitions;
};

// Read only recognized, declarative generator output. Libraries still construct
// the components with their real factories, and React still renders the SVG.
// Cache lifetime is one sprite build; modified and unknown layouts use imports.
export const createStaticIconLoader = () => {
  const readSource = createSourceReader();
  const packs = new Map<string, Promise<Map<string, string> | null>>();
  const recipes = new Map<string, Promise<Recipe | null>>();
  const factories = new Map<string, Promise<Record<string, unknown>>>();
  const parse = createModuleParser();
  return async (
    pack: string,
    file: string,
    exportName: string,
    version?: string,
  ): Promise<unknown | null> => {
    try {
      let recipe: Recipe | null = null;
      if (
        /^react-icons\/[\w-]+$/.test(pack) &&
        version?.startsWith('5.') &&
        path.basename(file) === 'index.mjs'
      ) {
        let pendingPack = packs.get(file);
        if (!pendingPack) {
          pendingPack = readSource(file).then(readReactIconsPack);
          packs.set(file, pendingPack);
        }
        const definitions = await pendingPack;
        const json = definitions?.get(exportName);
        if (json) {
          recipe = {
            factoryFile: path.resolve(path.dirname(file), '../lib/index.mjs'),
            factoryExport: 'GenIcon',
            args: [
              JSON.parse(json, (name, value: unknown) => {
                if (name === '__proto__') {
                  throw new Error('Unsupported property');
                }
                return value;
              }) as StaticValue,
            ],
          };
        }
      } else if (pack === 'lucide-react' && /^(?:0|1)\./.test(version ?? '')) {
        const key = JSON.stringify([file, exportName]);
        let pendingRecipe = recipes.get(key);
        if (!pendingRecipe) {
          pendingRecipe = readSource(file).then((source) => {
            const program = parse(file, source);
            return program && lucideRecipe(program, file, exportName);
          });
          recipes.set(key, pendingRecipe);
        }
        recipe = await pendingRecipe;
      }
      if (!recipe) {
        return null;
      }
      let imported = factories.get(recipe.factoryFile);
      if (!imported) {
        imported = import(pathToFileURL(recipe.factoryFile).href) as Promise<
          Record<string, unknown>
        >;
        factories.set(recipe.factoryFile, imported);
      }
      const factory = (await imported)[recipe.factoryExport];
      return typeof factory === 'function'
        ? (factory as Factory)(...recipe.args)
        : null;
    } catch {
      return null;
    }
  };
};
