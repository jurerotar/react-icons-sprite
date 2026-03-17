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
): Promise<RenderedIcon> => {
  const importPath = resolveIconImport(pack, exportName);
  const imported = (await import(importPath)) as Record<string, unknown>;
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
