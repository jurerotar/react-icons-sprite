import type { Node } from 'oxc-parser';

// Scope declarations are collected separately. Here we distinguish a binding's
// uses from property names, labels and declaration identifiers.
export const isReferenced = (
  node: Node,
  parent: Node,
  grandparent?: Node,
): boolean => {
  switch (parent.type) {
    case 'MemberExpression':
      return parent.object === node || parent.computed;
    case 'JSXMemberExpression':
      return parent.object === node;
    case 'Property':
      return parent.key === node
        ? parent.computed
        : grandparent?.type !== 'ObjectPattern';
    case 'MethodDefinition':
    case 'TSAbstractMethodDefinition':
    case 'PropertyDefinition':
    case 'TSAbstractPropertyDefinition':
    case 'AccessorProperty':
      return parent.key !== node || parent.computed;
    case 'VariableDeclarator':
      return parent.init === node;
    case 'AssignmentPattern':
      return parent.right === node;
    case 'FunctionDeclaration':
    case 'FunctionExpression':
    case 'TSDeclareFunction':
    case 'TSEmptyBodyFunctionExpression':
    case 'ArrowFunctionExpression':
      return parent.body === node;
    case 'ClassDeclaration':
    case 'ClassExpression':
      return parent.superClass === node;
    case 'ExportSpecifier':
      return (
        parent.local === node &&
        !(grandparent && 'source' in grandparent && grandparent.source)
      );
    case 'TSQualifiedName':
      return parent.left === node;
    case 'TSEnumMember':
      return parent.initializer === node;
    case 'ImportSpecifier':
    case 'ImportDefaultSpecifier':
    case 'ImportNamespaceSpecifier':
    case 'ImportAttribute':
    case 'ObjectPattern':
    case 'ArrayPattern':
    case 'RestElement':
    case 'CatchClause':
    case 'LabeledStatement':
    case 'BreakStatement':
    case 'ContinueStatement':
    case 'MetaProperty':
    case 'JSXAttribute':
      return false;
    default:
      // Retain imports for unfamiliar reference contexts instead of deleting a
      // potentially live binding. Assignment/update targets count as live too.
      return true;
  }
};
