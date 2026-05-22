import { kebabCase } from './kebab-case';

export const normalizePackAlias = (pack: string): string => {
  return kebabCase(pack.replace(/^@/, ''));
};

export const computeIconId = (pack: string, iconName: string): string => {
  return `ri-${normalizePackAlias(pack)}-${iconName}`;
};
