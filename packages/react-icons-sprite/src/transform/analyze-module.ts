import { visitorKeys as VISITOR_KEYS } from 'oxc-parser';
import { isReferenced as referenceCheck } from './is-referenced';
import type { Program, ImportDeclaration, JSXElement, Node } from 'oxc-parser';

const isReferenced = referenceCheck;

type Identifier = Extract<Node, { type: 'Identifier' }>;

export type Binding = { identifier: Identifier; references: Node[] };
type Scope = {
  parent?: Scope;
  functionScope: boolean;
  bindings: Record<string, Binding | undefined>;
  resolved: Record<string, Binding | null | undefined>;
  references?: (Identifier | Extract<Node, { type: 'JSXIdentifier' }>)[];
};
export type ScopedNode<T extends Node> = { node: T; scope: Scope };

export const getBinding = (scope: Scope, name: string): Binding | undefined => {
  const cached = scope.resolved[name];
  if (cached !== undefined) {
    return cached ?? undefined;
  }
  const binding =
    scope.bindings[name] ?? (scope.parent && getBinding(scope.parent, name));
  scope.resolved[name] = binding ?? null;
  return binding;
};

export const analyzeModule = (ast: Program) => {
  const imports: ScopedNode<ImportDeclaration>[] = [];
  const elements: ScopedNode<JSXElement>[] = [];
  const names = new Set<string>();
  const bindings: Binding[] = [];
  const root: Scope = {
    functionScope: true,
    bindings: Object.create(null),
    resolved: Object.create(null),
  };
  const scopes = [root];
  const tracked = new Set<string>();
  for (const node of ast.body) {
    if (node.type !== 'ImportDeclaration') {
      continue;
    }
    imports.push({ node, scope: root });
    for (const specifier of node.specifiers) {
      tracked.add(specifier.local.name);
      names.add(specifier.local.name);
      const binding = { identifier: specifier.local, references: [] };
      root.bindings[specifier.local.name] = binding;
      bindings.push(binding);
    }
  }

  const bind = (node: Node | null | undefined, scope: Scope): void => {
    if (!node) {
      return;
    }
    switch (node.type) {
      case 'Identifier':
        if (tracked.has(node.name) && scope.bindings[node.name] === undefined) {
          const binding = { identifier: node, references: [] };
          scope.bindings[node.name] = binding;
          bindings.push(binding);
        }
        return;
      case 'AssignmentPattern':
        bind(node.left, scope);
        return;
      case 'RestElement':
        bind(node.argument, scope);
        return;
      case 'ObjectPattern':
        for (const property of node.properties) {
          bind(
            property.type === 'RestElement'
              ? property.argument
              : property.value,
            scope,
          );
        }
        return;
      case 'ArrayPattern':
        for (const element of node.elements) {
          bind(element, scope);
        }
        return;
      case 'TSParameterProperty':
        bind(node.parameter, scope);
        return;
    }
  };

  const walk = (
    node: Node,
    inherited: Scope,
    parent?: Node,
    grandparent?: Node,
  ): void => {
    if (node.type === 'ImportDeclaration') {
      return;
    }
    if (node.type === 'Identifier' || node.type === 'JSXIdentifier') {
      names.add(node.name);
      if (
        tracked.has(node.name) &&
        parent &&
        isReferenced(node, parent, grandparent)
      ) {
        inherited.references ??= [];
        inherited.references.push(node);
      }
      return;
    }
    if (node.type === 'JSXElement') {
      elements.push({ node, scope: inherited });
      const opening = node.openingElement;
      walk(opening.name, inherited, opening, node);
      for (const attribute of opening.attributes) {
        if (attribute.type === 'JSXSpreadAttribute') {
          walk(attribute.argument, inherited, attribute, opening);
        } else if (attribute.value?.type === 'JSXExpressionContainer') {
          walk(
            attribute.value.expression,
            inherited,
            attribute.value,
            attribute,
          );
        }
      }
      for (const child of node.children) {
        if (child.type === 'JSXElement' || child.type === 'JSXFragment') {
          walk(child, inherited, node, parent);
        } else if (
          child.type === 'JSXExpressionContainer' ||
          child.type === 'JSXSpreadChild'
        ) {
          walk(child.expression, inherited, child, node);
        }
      }
      return;
    }
    if (node.type === 'JSXFragment') {
      for (const child of node.children) {
        if (child.type === 'JSXElement' || child.type === 'JSXFragment') {
          walk(child, inherited, node, parent);
        } else if (
          child.type === 'JSXExpressionContainer' ||
          child.type === 'JSXSpreadChild'
        ) {
          walk(child.expression, inherited, child, node);
        }
      }
      return;
    }
    let scope = inherited;
    if (
      node.type === 'FunctionDeclaration' ||
      node.type === 'ClassDeclaration' ||
      node.type === 'TSEnumDeclaration' ||
      node.type === 'TSModuleDeclaration'
    ) {
      bind(node.id, inherited);
    }
    const isFunction =
      node.type === 'FunctionDeclaration' ||
      node.type === 'FunctionExpression' ||
      node.type === 'ArrowFunctionExpression';
    if (
      isFunction ||
      node.type === 'BlockStatement' ||
      node.type === 'CatchClause' ||
      node.type === 'ForStatement' ||
      node.type === 'ForInStatement' ||
      node.type === 'ForOfStatement' ||
      node.type === 'SwitchStatement' ||
      node.type === 'ClassDeclaration' ||
      node.type === 'ClassExpression' ||
      node.type === 'StaticBlock' ||
      node.type === 'TSModuleDeclaration' ||
      node.type === 'TSEnumDeclaration'
    ) {
      scope = {
        parent: inherited,
        functionScope:
          isFunction ||
          node.type === 'StaticBlock' ||
          node.type === 'TSModuleDeclaration',
        bindings: Object.create(null),
        resolved: Object.create(null),
      };
      scopes.push(scope);
    }
    if ('params' in node && isFunction) {
      for (const parameter of node.params) {
        bind(parameter, scope);
      }
    }
    if (
      node.type === 'FunctionExpression' ||
      node.type === 'ClassExpression' ||
      node.type === 'ClassDeclaration'
    ) {
      bind(node.id, scope);
    }
    if (node.type === 'TSImportEqualsDeclaration') {
      bind(node.id, scope);
    }
    if (node.type === 'CatchClause') {
      bind(node.param, scope);
    }
    if (node.type === 'VariableDeclaration') {
      let target = scope;
      if (node.kind === 'var') {
        while (!target.functionScope && target.parent) {
          target = target.parent;
        }
      }
      for (const declaration of node.declarations) {
        bind(declaration.id, target);
      }
    }
    if (node.type === 'TSEnumDeclaration') {
      for (const member of node.body.members) {
        bind(member.id, scope);
      }
    }
    const record = node as unknown as Record<
      string,
      Node | Node[] | null | undefined
    >;
    for (const key of VISITOR_KEYS[node.type] ?? []) {
      const child = record[key];
      // Computed method keys and decorators are evaluated outside the method's parameter scope.
      const childScope =
        isFunction && (key === 'key' || key === 'decorators')
          ? inherited
          : scope;
      if (Array.isArray(child)) {
        for (const item of child) {
          if (item) {
            walk(item, childScope, node, parent);
          }
        }
      } else if (child) {
        walk(child, childScope, node, parent);
      }
    }
  };
  walk(ast, root);
  // Resolve only after every declaration is collected, including hoisted and TDZ bindings.
  for (const scope of scopes) {
    for (const reference of scope.references ?? []) {
      getBinding(scope, reference.name)?.references.push(reference);
    }
  }
  return { imports, elements, names, bindings };
};
