export const fastFilter = (code: string): boolean => {
  if (!code.includes('<')) {
    return false;
  }
  if (!code.includes('import')) {
    return false;
  }
  return true;
};
