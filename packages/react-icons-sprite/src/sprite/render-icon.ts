import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { resolveIconImport } from '../packs/icon-resolvers';

export type RenderedIcon = {
  symbolBody: string;
  viewBox: string;
  symbolAttributes: string;
};

const SVG_INNER_RE = /<svg\b[^>]*>([\s\S]*?)<\/svg>/i;
const VIEWBOX_RE = /viewBox=["']([^"']+)["']/i;
const SVG_OPEN_RE = /<svg\b([^>]*)>/i;
const SVG_ATTR_RE = /([:\w-]+)=("[^"]*"|'[^']*')/g;

const OMITTED_SVG_ATTRIBUTES = new Set(['xmlns', 'viewBox', 'width', 'height']);

type PackageJson = {
  exports?: unknown;
  module?: string;
  main?: string;
};

type RenderIconOptions = {
  baseDir?: string;
};

const parsePackageSpecifier = (
  specifier: string,
): { packageName: string; subpath: string } | null => {
  if (specifier.startsWith('.') || path.isAbsolute(specifier)) {
    return null;
  }

  const parts = specifier.split('/');
  const packageName = specifier.startsWith('@')
    ? `${parts[0]}/${parts[1]}`
    : parts[0];
  const rest = parts.slice(specifier.startsWith('@') ? 2 : 1).join('/');

  return {
    packageName,
    subpath: rest ? `./${rest}` : '.',
  };
};

const findPackageRoot = (
  packageName: string,
  baseDir: string,
): string | null => {
  let current = path.resolve(baseDir);
  while (true) {
    const candidate = path.join(current, 'node_modules', packageName);
    if (existsSync(path.join(candidate, 'package.json'))) {
      return candidate;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
};

const pickExportTarget = (value: unknown): string | null => {
  if (typeof value === 'string') {
    return value;
  }

  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  return (
    pickExportTarget(record.import) ??
    pickExportTarget(record.default) ??
    pickExportTarget(record.module) ??
    pickExportTarget(record.require)
  );
};

const resolveExportTarget = (
  exportsField: unknown,
  subpath: string,
): string | null => {
  if (typeof exportsField === 'string' || Array.isArray(exportsField)) {
    return subpath === '.' ? pickExportTarget(exportsField) : null;
  }

  if (!exportsField || typeof exportsField !== 'object') {
    return null;
  }

  const exportsRecord = exportsField as Record<string, unknown>;

  const exact = pickExportTarget(exportsRecord[subpath]);
  if (exact) {
    return exact;
  }

  for (const [key, value] of Object.entries(exportsRecord)) {
    if (!key.includes('*')) {
      continue;
    }

    const [prefix, suffix] = key.split('*');
    if (!subpath.startsWith(prefix) || !subpath.endsWith(suffix)) {
      continue;
    }

    const matched = subpath.slice(
      prefix.length,
      subpath.length - suffix.length,
    );
    const target = pickExportTarget(value);
    if (target) {
      return target.replaceAll('*', matched);
    }
  }

  return null;
};

const fileExists = (filePath: string): boolean => existsSync(filePath);

const resolveFileCandidate = (filePath: string): string | null => {
  const candidates = [
    filePath,
    `${filePath}.mjs`,
    `${filePath}.js`,
    path.join(filePath, 'index.mjs'),
    path.join(filePath, 'index.js'),
  ];

  return candidates.find(fileExists) ?? null;
};

const resolveFromBaseDir = (
  specifier: string,
  baseDir: string,
): string | null => {
  const parsed = parsePackageSpecifier(specifier);
  if (!parsed) {
    return null;
  }

  const packageRoot = findPackageRoot(parsed.packageName, baseDir);
  if (!packageRoot) {
    return null;
  }

  const packageJson = JSON.parse(
    readFileSync(path.join(packageRoot, 'package.json'), 'utf8'),
  ) as PackageJson;
  const exportTarget = resolveExportTarget(packageJson.exports, parsed.subpath);

  if (exportTarget) {
    return resolveFileCandidate(path.join(packageRoot, exportTarget)) ?? null;
  }

  if (parsed.subpath === '.') {
    const entry = packageJson.module ?? packageJson.main;
    if (entry) {
      return resolveFileCandidate(path.join(packageRoot, entry));
    }
  }

  return resolveFileCandidate(path.join(packageRoot, parsed.subpath));
};

const resolveImportSpecifier = (
  specifier: string,
  options: RenderIconOptions,
): string => {
  if (!options.baseDir) {
    return specifier;
  }

  const resolved = resolveFromBaseDir(specifier, options.baseDir);
  return resolved ? pathToFileURL(resolved).href : specifier;
};

export const extractSymbolAttributes = (svgMarkup: string): string => {
  const openingAttributes = SVG_OPEN_RE.exec(svgMarkup)?.[1];
  if (!openingAttributes) {
    return '';
  }

  const attributes: string[] = [];

  for (const [, name, value] of openingAttributes.matchAll(SVG_ATTR_RE)) {
    if (OMITTED_SVG_ATTRIBUTES.has(name)) {
      continue;
    }
    attributes.push(`${name}=${value}`);
  }

  return attributes.join(' ');
};

const pickExport = (
  moduleExports: Record<string, unknown>,
  exportName: string,
): unknown => {
  if (exportName === 'default') {
    return moduleExports.default;
  }
  return moduleExports[exportName] ?? moduleExports.default;
};

export const isRenderableComponent = (
  value: unknown,
): value is ComponentType<Record<string, unknown>> => {
  if (typeof value === 'function') {
    return true;
  }

  if (!value || typeof value !== 'object') {
    return false;
  }

  const maybeExoticComponent = value as Record<string, unknown>;
  return '$$typeof' in maybeExoticComponent;
};

type FontAwesomeIconTuple = [
  width: number,
  height: number,
  ligatures: unknown,
  unicode: string,
  svgPathData: string | string[],
];

type FontAwesomeIconDefinition = {
  icon: FontAwesomeIconTuple;
};

export const isFontAwesomeIconDefinition = (
  value: unknown,
): value is FontAwesomeIconDefinition => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const icon = (value as { icon?: unknown }).icon;
  if (!Array.isArray(icon) || icon.length < 5) {
    return false;
  }

  return typeof icon[0] === 'number' && typeof icon[1] === 'number';
};

const renderFontAwesomeIconDefinition = (
  iconDefinition: FontAwesomeIconDefinition,
): RenderedIcon => {
  const [width, height, , , svgPathData] = iconDefinition.icon;
  const paths = Array.isArray(svgPathData) ? svgPathData : [svgPathData];
  const symbolBody = paths.map((d) => `<path d="${d}"/>`).join('');

  return {
    symbolBody,
    viewBox: `0 0 ${width} ${height}`,
    symbolAttributes: '',
  };
};

export const renderIcon = async (
  pack: string,
  exportName: string,
  options: RenderIconOptions = {},
): Promise<RenderedIcon> => {
  const importPath = resolveIconImport(pack, exportName);
  const imported = (await import(
    resolveImportSpecifier(importPath, options)
  )) as Record<string, unknown>;
  const iconComponent = pickExport(imported, exportName);

  if (isFontAwesomeIconDefinition(iconComponent)) {
    return renderFontAwesomeIconDefinition(iconComponent);
  }

  if (!isRenderableComponent(iconComponent)) {
    throw new Error(
      `[react-icons-sprite] Unable to render icon "${exportName}" from "${pack}". ` +
        'Expected a React component export.',
    );
  }

  const svgMarkup = renderToStaticMarkup(
    createElement(iconComponent as ComponentType<Record<string, unknown>>),
  );

  const svgInner = SVG_INNER_RE.exec(svgMarkup)?.[1];
  if (!svgInner) {
    throw new Error(
      `[react-icons-sprite] Unable to extract SVG content for "${exportName}" from "${pack}".`,
    );
  }

  const viewBox = VIEWBOX_RE.exec(svgMarkup)?.[1] ?? '0 0 24 24';
  const symbolAttributes = extractSymbolAttributes(svgMarkup);

  return {
    symbolBody: svgInner,
    viewBox,
    symbolAttributes,
  };
};
