export const fastFilter = (code: string): boolean => {
  if (!code.includes('<')) {
    return false;
  }
  // Substrings such as CSS "important" are common in large runtime modules.
  // Only the import keyword can introduce the declarations we transform.
  if (!/\bimport\b/.test(code)) {
    return false;
  }
  return true;
};
