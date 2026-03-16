import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { resolveIconImport } from '../packs/icon-resolvers';

export type RenderedIcon = {
  symbolBody: string;
  viewBox: string;
};

const SVG_INNER_RE = /<svg\b[^>]*>([\s\S]*?)<\/svg>/i;
const VIEWBOX_RE = /viewBox=["']([^"']+)["']/i;

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

export const renderIcon = async (
  pack: string,
  exportName: string,
): Promise<RenderedIcon> => {
  const importPath = resolveIconImport(pack, exportName);
  const imported = (await import(importPath)) as Record<string, unknown>;
  const iconComponent = pickExport(imported, exportName);

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
  return {
    symbolBody: svgInner,
    viewBox,
  };
};
