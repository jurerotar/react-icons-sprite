export const detectUsage = (code: string, names: string[]): boolean => {
  if (!names.length) {
    return false;
  }

  const escaped = names.map((name) =>
    name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
  );
  const jsxRegex = new RegExp(`<(${escaped.join('|')})\\b`);
  return jsxRegex.test(code);
};
